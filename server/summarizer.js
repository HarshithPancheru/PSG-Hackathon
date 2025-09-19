function generateSummary(transcript) {
    // Simple: join main sentences
    const keySentences = transcript.map(t => `${t.speaker}: ${t.text}`);
    return "Meeting Summary:\n" + keySentences.join("\n");
  }
  
  function extractActionItems(transcript) {
    // Rule-based: detect "will", "shall", "I'll"
    const actionRegex = /\b(will|shall|i'?ll)\b/i;
    const actions = transcript
      .filter(t => actionRegex.test(t.text))
      .map(t => ({
        speaker: t.speaker,
        action: t.text,
        confidence: 0.8
      }));
    return actions;
  }
  
  function engagementMetrics(transcript) {
    const stats = {};
    transcript.forEach(t => {
      if (!stats[t.speaker]) {
        stats[t.speaker] = { turns: 0, words: 0 };
      }
      stats[t.speaker].turns += 1;
      stats[t.speaker].words += t.text.split(" ").length;
    });
  
    const totalWords = Object.values(stats).reduce((a, b) => a + b.words, 0);
  
    for (let speaker in stats) {
      stats[speaker].speakingShare = (stats[speaker].words / totalWords).toFixed(2);
    }
  
    return stats;
  }
  
  // Master function
  function processTranscript(transcript) {
    return {
      summary: generateSummary(transcript),
      actions: extractActionItems(transcript),
      engagement: engagementMetrics(transcript)
    };
  }
  
  module.exports = { processTranscript };