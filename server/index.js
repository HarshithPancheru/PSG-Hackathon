// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const state = require('./state');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());

// Try to load summarizer.js if team member C creates it.
// summarizer.js should export a function generateMom(transcripts, room)
let summarizer = null;
try {
  summarizer = require('./summarizer');
  if (typeof summarizer.generateMom !== 'function') {
    console.warn('summarizer.js loaded but generateMom not found — ignoring.');
    summarizer = null;
  } else {
    console.log('Loaded external summarizer.js');
  }
} catch (err) {
  console.log('No external summarizer.js found — using fallback summarizer.');
}

// Fallback summarizer (basic rule-based) — used if summarizer.js is absent.
function fallbackGenerateMom(transcripts = [], room = '') {
  // transcripts: [{userId, displayName, text, ts}]
  const result = {
    room,
    generatedAt: Date.now(),
    summary: '',
    actionItems: [],
    engagement: {},
    confidence: 0.5
  };

  if (!transcripts || transcripts.length === 0) {
    result.summary = 'No transcript available yet.';
    result.confidence = 0.2;
    return result;
  }

  // speaking counts (rough engagement)
  const counts = {};
  transcripts.forEach(t => {
    counts[t.userId] = (counts[t.userId] || 0) + 1;
  });
  result.engagement = counts;

  // simple extractive summary: take last 3 transcript lines concatenated
  const lastN = transcripts.slice(-6).map(t => `${t.displayName}: ${t.text}`);
  result.summary = lastN.join(' | ').slice(0, 800);

  // action item detection using simple keywords and heuristics
  const actionKeywords = /\b(action|todo|will|by|due|assign|please|follow up|deadline|review|implement|test|fix)\b/i;
  const actions = [];
  transcripts.forEach(t => {
    if (actionKeywords.test(t.text)) {
      // try to extract assignee by looking for "Alice will ..." or "Bob:"
      const assigneeMatch = t.text.match(/^\s*([A-Z][a-z0-9_-]{1,20})\b|([A-Z][a-z0-9_-]{1,20})\s+will\b/i);
      const assignee = assigneeMatch ? (assigneeMatch[1] || assigneeMatch[2]) : t.displayName;
      // due detection (very naive)
      const dueMatch = t.text.match(/\b(by|due)\s+([A-Za-z0-9\-\/]+)/i);
      const due = dueMatch ? dueMatch[2] : null;
      actions.push({
        assignee,
        text: t.text,
        due,
        confidence: 0.6
      });
    }
  });
  result.actionItems = actions.slice(0, 10);
  result.confidence = 0.5 + Math.min(0.4, actions.length * 0.05);
  return result;
}

const generateMom = (transcripts, room) => {
  if (summarizer && typeof summarizer.generateMom === 'function') {
    try {
      return summarizer.generateMom(transcripts, room);
    } catch (err) {
      console.error('Error in external summarizer, falling back:', err);
      return fallbackGenerateMom(transcripts, room);
    }
  } else {
    return fallbackGenerateMom(transcripts, room);
  }
};

// Basic routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/rooms', (req, res) => {
  const rooms = state.listRooms();
  res.json({ rooms });
});

app.get('/rooms/:room/mom', (req, res) => {
  const room = req.params.room;
  const mom = state.getMom(room);
  if (!mom) return res.status(404).json({ error: 'no_mom', message: `No MOM generated yet for room ${room}` });
  res.json({ room, lastMom: mom });
});

// POST /mock-transcript - helpful for frontend dev to test server without browser STT
app.post('/mock-transcript', (req, res) => {
  const { room, userId, displayName, text, ts } = req.body || {};
  if (!room || !userId || !text) return res.status(400).json({ error: 'bad_request', message: 'room,userId,text required' });

  const entry = {
    room,
    userId,
    displayName: displayName || userId,
    text,
    ts: ts || Date.now()
  };
  state.addTranscript(room, entry);
  // broadcast via internal emitter later when socket.io is up (we will call emit when socket is ready)
  // store in a queue so that sockets pick it up after server starts
  if (global.io) {
    global.io.to(room).emit('transcript_broadcast', { room, entry });
  }
  res.status(201).json({ status: 'ok', message: 'transcript added', entry });
});

app.post('/rooms/:room/request-mom', (req, res) => {
  const room = req.params.room;
  const transcripts = state.getTranscripts(room);
  const mom = generateMom(transcripts, room);
  state.setMom(room, mom);
  if (global.io) {
    global.io.to(room).emit('mom_update', mom);
  }
  res.json({ status: 'ok', message: 'MOM generation triggered', mom });
});

// Create server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
// Make io globally available for REST handlers to emit (simple approach)
global.io = io;

io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);

  socket.on('join-room', (payload) => {
    const { room, userId, displayName } = payload || {};
    if (!room || !userId) {
      return socket.emit('error', { code: 'bad_request', message: 'room and userId required' });
    }
    socket.join(room);
    // store mapping
    state.addParticipant(room, {
      userId,
      displayName: displayName || userId,
      socketId: socket.id,
      joinedAt: Date.now()
    });
    // emit update
    io.to(room).emit('participants_update', { room, participants: state.getParticipants(room) });
    console.log(`${displayName || userId} joined room ${room}`);
  });

  socket.on('leave-room', (payload) => {
    const { room, userId } = payload || {};
    if (room && userId) {
      state.removeParticipant(room, userId);
      io.to(room).emit('participants_update', { room, participants: state.getParticipants(room) });
    }
    try { socket.leave(room); } catch (e) {}
  });

  // signaling event - relays offers/answers/ice
  socket.on('signal', (payload) => {
    const { room, from, to, type, data } = payload || {};
    if (!room || !from || !type || !data) {
      return socket.emit('error', { code: 'bad_request', message: 'signal requires room,from,type,data' });
    }
    if (to) {
      // forward to specific participant
      const target = state.findParticipantByUserId(room, to);
      if (target && target.socketId) {
        io.to(target.socketId).emit('signal', payload);
      } else {
        socket.emit('error', { code: 'invalid_target', message: `target ${to} not found in room ${room}` });
      }
    } else {
      // broadcast to room (except sender)
      socket.to(room).emit('signal', payload);
    }
  });

  // transcript event from clients
  socket.on('transcript', (entry) => {
    // entry: {room, userId, displayName, text, ts}
    if (!entry || !entry.room || !entry.userId || !entry.text) {
      return socket.emit('error', { code: 'bad_request', message: 'transcript requires room,userId,text' });
    }
    state.addTranscript(entry.room, {
      userId: entry.userId,
      displayName: entry.displayName || entry.userId,
      text: entry.text,
      ts: entry.ts || Date.now()
    });

    // broadcast to room
    io.to(entry.room).emit('transcript_broadcast', { room: entry.room, entry });
    // Optionally, we can run summarizer on every transcript (lightweight fallback) or on timer.
    // Here we do nothing immediate to avoid CPU spikes. Summaries are generated on request or on periodic timer below.
  });

  socket.on('request_mom', (payload) => {
    const { room } = payload || {};
    if (!room) return socket.emit('error', { code: 'bad_request', message: 'room required' });
    const transcripts = state.getTranscripts(room);
    const mom = generateMom(transcripts, room);
    state.setMom(room, mom);
    io.to(room).emit('mom_update', mom);
  });

  // optional stats update from clients
  socket.on('stats_update', (payload) => {
    // payload: {room, userId, stats}
    if (!payload || !payload.room || !payload.userId) return;
    state.setParticipantMetrics(payload.room, payload.userId, payload.stats || {});
    io.to(payload.room).emit('participants_metrics', { room: payload.room, metrics: state.getMetrics(payload.room) });
  });

  socket.on('disconnect', () => {
    // remove participant(s) associated with this socket
    state.removeParticipantBySocketId(socket.id);
    // broadcast participant updates for affected rooms
    const rooms = state.listRooms();
    rooms.forEach(r => {
      io.to(r.room).emit('participants_update', { room: r.room, participants: state.getParticipants(r.room) });
    });
    console.log('socket disconnected', socket.id);
  });
});

// Periodic summarizer run (every 25 seconds) — generate MOM for rooms with new transcripts
setInterval(() => {
  const rooms = state.listRooms();
  rooms.forEach(r => {
    const transcripts = state.getTranscripts(r.room);
    // only generate if there are transcripts and last generated was older than threshold
    const lastMom = state.getMom(r.room);
    const lastTs = lastMom ? lastMom.generatedAt : 0;
    // if new transcripts exist after last generated moment, regenerate
    const newestTranscript = transcripts.length ? transcripts[transcripts.length - 1].ts : 0;
    if (newestTranscript > lastTs) {
      const mom = generateMom(transcripts, r.room);
      state.setMom(r.room, mom);
      io.to(r.room).emit('mom_update', mom);
      console.log(`Generated MOM for room ${r.room} at ${new Date(mom.generatedAt).toISOString()}`);
    }
  });
}, 25 * 1000);

// Start server
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});