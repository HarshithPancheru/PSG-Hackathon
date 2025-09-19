// speech.js
export function startRecognition(onResult, onInfo) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onInfo && onInfo('SpeechRecognition not supported');
    return null;
  }
  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = 'en-US';

  rec.onresult = (ev) => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const text = ev.results[i][0].transcript.trim();
      if (text) onResult && onResult(text);
    }
  };
  rec.onerror = (e) => { onInfo && onInfo('SpeechRecognition error: ' + (e.error || e.message)); };
  rec.onend = () => { onInfo && onInfo('Recognition stopped'); };
  rec.start();
  onInfo && onInfo('Recognition started');
  return rec;
}

export function stopRecognition(rec) {
  try { rec && rec.stop(); } catch(e) {}
}
