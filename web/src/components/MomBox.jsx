import React from 'react';

export default function MomBox({ mom }) {
  return (
    <div className="panel mom">
      <h3>Minutes of Meeting</h3>
      {!mom ? <div className="muted">No MOM yet</div> : (
        <div>
          <div><strong>Summary:</strong> {mom.summary}</div>
          <div className="mt"> <strong>Action items:</strong>
            <ul>{(mom.actionItems || []).map((a,i)=><li key={i}>{a}</li>)}</ul>
          </div>
          <div className="muted">Confidence: {mom.confidence ?? 0}</div>
        </div>
      )}
    </div>
  );
}
