import React, { useEffect, useRef } from 'react';

export default function VideoPanel({ localStream, remoteStream }) {
  const localRef = useRef(null), remoteRef = useRef(null);

  useEffect(() => { if (localRef.current && localStream) localRef.current.srcObject = localStream }, [localStream]);
  useEffect(() => { if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream }, [remoteStream]);

  return (
    <div className="video-panel">
      <div className="video-card">
        <div className="card-title">You</div>
        <video ref={localRef} autoPlay muted playsInline className="video" />
      </div>
      <div className="video-card">
        <div className="card-title">Remote</div>
        <video ref={remoteRef} autoPlay playsInline className="video" />
      </div>
    </div>
  );
}
