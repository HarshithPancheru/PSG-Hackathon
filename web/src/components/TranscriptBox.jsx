import React, { useRef, useEffect, useState } from 'react';

export default function TranscriptBox({ transcripts = [], onManual }) {
  const listRef = useRef(null);
  const [manual, setManual] = useState('');

  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, [transcripts]);

  return (
    <div className="panel transcript">
      <h3>Transcript</h3>
      <div ref={listRef} className="transcript-list">
        {transcripts.length === 0 ? <div className="muted">No transcript yet</div> : transcripts.map((t,i)=>(
          <div key={i}><strong>{t.user}:</strong> {t.text}</div>
        ))}
      </div>

      <div className="manual">
        <input placeholder="Type a note..." value={manual} onChange={e=>setManual(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'){ onManual(manual); setManual('') }}} />
        <button onClick={()=>{ onManual(manual); setManual('') }}>Send</button>
      </div>
    </div>
  );
}
