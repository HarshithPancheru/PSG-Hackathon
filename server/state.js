// server/state.js
// Simple in-memory store for participants, transcripts, MOMs.
// This is intentionally simple for hackathon/demo use only.

const rooms = {}; // map room -> { participants: {userId: {..}}, transcripts: [], mom: {}, metrics: {} }

function ensureRoom(room) {
  if (!rooms[room]) {
    rooms[room] = { participants: {}, transcripts: [], mom: null, metrics: {} };
  }
  return rooms[room];
}

function addParticipant(room, participant) {
  // participant: {userId, displayName, socketId, joinedAt}
  const r = ensureRoom(room);
  r.participants[participant.userId] = participant;
}

function removeParticipant(room, userId) {
  const r = rooms[room];
  if (!r) return;
  delete r.participants[userId];
  // if room empty, optionally remove the room (we keep for moment-to-moment)
  if (Object.keys(r.participants).length === 0 && (!r.transcripts || r.transcripts.length === 0)) {
    delete rooms[room];
  }
}

function removeParticipantBySocketId(socketId) {
  for (const room in rooms) {
    const p = rooms[room].participants;
    for (const userId in p) {
      if (p[userId].socketId === socketId) {
        delete p[userId];
      }
    }
    // clean empty rooms if no participants and no transcripts
    if (Object.keys(rooms[room].participants).length === 0 && (!rooms[room].transcripts || rooms[room].transcripts.length === 0)) {
      delete rooms[room];
    }
  }
}

function getParticipants(room) {
  const r = rooms[room];
  if (!r) return [];
  return Object.values(r.participants);
}

function findParticipantByUserId(room, userId) {
  const r = rooms[room];
  if (!r) return null;
  return r.participants[userId] || null;
}

function addTranscript(room, transcriptEntry) {
  // transcriptEntry: {userId, displayName, text, ts}
  const r = ensureRoom(room);
  r.transcripts.push(transcriptEntry);
  // keep transcripts bounded to last N for memory safety (e.g., 2000 entries)
  const MAX = 2000;
  if (r.transcripts.length > MAX) r.transcripts.splice(0, r.transcripts.length - MAX);
  return transcriptEntry;
}

function getTranscripts(room) {
  const r = rooms[room];
  return r ? r.transcripts : [];
}

function setMom(room, mom) {
  const r = ensureRoom(room);
  r.mom = mom;
}

function getMom(room) {
  const r = rooms[room];
  return r ? r.mom : null;
}

function listRooms() {
  return Object.keys(rooms).map(r => ({
    room: r,
    participants: Object.keys(rooms[r].participants).length,
    lastUpdated: (rooms[r].transcripts.length ? rooms[r].transcripts[rooms[r].transcripts.length - 1].ts : 0)
  }));
}

function setParticipantMetrics(room, userId, metrics) {
  const r = ensureRoom(room);
  r.metrics[userId] = metrics;
}

function getMetrics(room) {
  const r = rooms[room];
  return r ? r.metrics : {};
}

module.exports = {
  addParticipant,
  removeParticipant,
  removeParticipantBySocketId,
  getParticipants,
  findParticipantByUserId,
  addTranscript,
  getTranscripts,
  setMom,
  getMom,
  listRooms,
  setParticipantMetrics,
  getMetrics
};
