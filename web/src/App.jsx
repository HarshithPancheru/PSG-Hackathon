import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { createPeerConnection, makeOffer, handleSignal, closePeer } from './webrtc';
import { startRecognition, stopRecognition } from './speech';
import VideoPanel from './components/VideoPanel';
import TranscriptBox from './components/TranscriptBox';
import MomBox from './components/MomBox';

const SOCKET_URL = ''; // empty => same origin (Vite proxy or server served)

export default function App() {
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState('room1');
  const [name, setName] = useState(`user_${Math.floor(Math.random()*1000)}`);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [mom, setMom] = useState(null);
  const [status, setStatus] = useState('idle');

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const recogRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL || undefined);
    socketRef.current = socket;

    socket.on('connect', () => setStatus('connected to signaling'));
    socket.on('disconnect', () => setStatus('disconnected'));

    socket.on('signal', async ({ from, data }) => {
      if (!pcRef.current && localStream) {
        pcRef.current = createPeerConnection({
          onRemoteStream: st => setRemoteStream(st),
          sendSignal: d => socket.emit('signal', { roomId, data: d })
        });
      }
      if (pcRef.current) await handleSignal(pcRef.current, data, localStream, d => socket.emit('signal', { roomId, data: d }));
    });

    socket.on('peer-joined', ({ id, userId }) => {
      setStatus(`peer joined ${userId||id}`);
      // create offer proactively
      if (pcRef.current && localStream) {
        makeOffer(pcRef.current, localStream, d => socket.emit('signal', { roomId, data: d }));
      }
    });

    socket.on('transcript', ({ userId, text, ts }) => {
      setTranscripts(prev => [...prev, { user: userId, text, ts }]);
    });

    socket.on('mom_update', (m) => setMom(m));

    return () => {
      socket.disconnect();
    };
  }, [localStream, roomId]);

  async function join() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(stream);
      setStatus('local media ready');

      pcRef.current = createPeerConnection({
        onRemoteStream: st => setRemoteStream(st),
        sendSignal: d => socketRef.current.emit('signal', { roomId, data: d })
      });

      socketRef.current.emit('join-room', { roomId, userId: name });
      setConnected(true);

      recogRef.current = startRecognition((text) => {
        const payload = { roomId, userId: name, text, ts: Date.now() };
        socketRef.current.emit('transcript', payload);
        setTranscripts(prev => [...prev, { user: name, text, ts: payload.ts }]);
      }, info => setStatus(info));

    } catch (e) {
      console.error(e);
      setStatus('media error: ' + (e.message || e));
    }
  }

  function leave() {
    try { socketRef.current.emit('leave-room', { roomId }); } catch {}
    stopRecognition(recogRef.current); recogRef.current = null;
    closePeer(pcRef.current); pcRef.current = null;
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setConnected(false);
    setTranscripts([]);
    setMom(null);
    setStatus('left');
  }

  function sendManual(text) {
    if (!text) return;
    const payload = { roomId, userId: name, text, ts: Date.now() };
    socketRef.current.emit('transcript', payload);
    setTranscripts(prev => [...prev, { user: name, text, ts: payload.ts }]);
  }

  function requestMom() {
    socketRef.current.emit('request_mom', { roomId });
  }

  return (
    <div className="app-root">
      <header className="topbar">
        <h1>Hackathon Meet</h1>
        <div className="status">{status}</div>
      </header>

      <section className="controls">
        <input value={roomId} onChange={e=>setRoomId(e.target.value)} placeholder="room-id" />
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="your name" />
        <button onClick={join} disabled={connected}>Join</button>
        <button onClick={leave} disabled={!connected}>Leave</button>
        <button onClick={requestMom} disabled={!connected}>Request MOM</button>
      </section>

      <main className="main-grid">
        <div className="left-col">
          <VideoPanel localStream={localStream} remoteStream={remoteStream} />
        </div>

        <div className="right-col">
          <TranscriptBox transcripts={transcripts} onManual={sendManual} />
          <MomBox mom={mom} />
        </div>
      </main>
    </div>
  );
}
