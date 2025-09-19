// webrtc.js
export function createPeerConnection({ iceServers = [{ urls: 'stun:stun.l.google.com:19302' }], onRemoteStream, sendSignal }) {
  const pc = new RTCPeerConnection({ iceServers });

  pc.ontrack = (ev) => {
    // first stream
    if (onRemoteStream) onRemoteStream(ev.streams[0]);
  };

  pc.onicecandidate = (ev) => {
    if (ev.candidate && sendSignal) {
      sendSignal({ type: 'ice-candidate', candidate: ev.candidate });
    }
  };

  return pc;
}

export async function makeOffer(pc, localStream, sendSignal) {
  if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendSignal({ type: 'offer', sdp: pc.localDescription.sdp, sdpType: pc.localDescription.type });
}

export async function handleSignal(pc, data, localStream, sendSignal) {
  if (data.type === 'offer') {
    if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    await pc.setRemoteDescription({ type: data.sdpType || 'offer', sdp: data.sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal({ type: 'answer', sdp: pc.localDescription.sdp, sdpType: pc.localDescription.type });
  } else if (data.type === 'answer') {
    await pc.setRemoteDescription({ type: data.sdpType || 'answer', sdp: data.sdp });
  } else if (data.type === 'ice-candidate') {
    try { await pc.addIceCandidate(data.candidate); } catch (e) { console.warn('addIceCandidate err', e); }
  }
}

export function closePeer(pc) {
  if (!pc) return;
  try { pc.getSenders().forEach(s => s.track && s.track.stop()); } catch {}
  try { pc.close(); } catch {}
}
