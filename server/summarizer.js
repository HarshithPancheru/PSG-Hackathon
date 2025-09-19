/**
 * Generates a high-quality, abstractive summary of the transcript using an AI model.
 * This approach understands context and identifies key themes, unlike simple sentence joining.
 * @param {Array<Object>} transcript - An array of transcript turn objects.
 * @returns {Promise<string>} A concise, human-readable summary of the meeting.
 */
async function generateAdvancedSummary(transcript) {
  console.log("Generating advanced summary...");
  // Format the transcript into a single string for the AI model.
  const fullText = transcript.map(t => `${t.speaker}: ${t.text}`).join("\n");

  // --- SIMULATED AI MODEL CALL ---
  // In a real application, you would replace this with an API call
  // to a service like the Google Gemini API.
  // const prompt = `Summarize the key decisions and outcomes from the following meeting transcript:\n\n${fullText}`;
  // const summary = await generativeAiModel.generateContent(prompt);
  // return summary.response.text();

  // For demonstration, we return a plausible-looking summary.
  return Promise.resolve(
    "The team discussed the Q3 marketing strategy, focusing on social media outreach. Alice will draft the campaign brief, and Bob will finalize the budget by Friday. The main goal is to increase user engagement by 15%."
  );
}

/**
 * Extracts action items using Natural Language Understanding (NLU).
 * This is more robust than a simple keyword search, as it understands intent.
 * @param {Array<Object>} transcript - An array of transcript turn objects.
 * @returns {Promise<Array<Object>>} A list of action items with assigned speakers and confidence.
 */
async function extractAdvancedActionItems(transcript) {
  console.log("Extracting action items with NLU...");
  const fullText = transcript.map(t => `${t.speaker}: ${t.text}`).join("\n");

  // --- SIMULATED AI MODEL CALL ---
  // A real API call would ask the model to find and structure action items.
  // const prompt = `From the transcript below, extract all action items. For each, identify the person responsible and the task. Return the result as a JSON array of objects with keys "speaker" and "action".\n\n${fullText}`;
  // const actions = await generativeAiModel.generateContent(prompt);
  // return JSON.parse(actions.response.text());

  // For demonstration, we return a more context-aware result than the original regex.
  return Promise.resolve([
    { speaker: "Alice", action: "Draft the campaign brief.", confidence: 0.95 },
    { speaker: "Bob", action: "Finalize the budget by Friday.", confidence: 0.98 }
  ]);
}

/**
 * Calculates engagement metrics based on speaking turns and word count.
 * This function is purely statistical and does not require AI.
 * @param {Array<Object>} transcript - An array of transcript turn objects.
 * @returns {Object} An object containing speaking stats for each participant.
 */
function engagementMetrics(transcript) {
  console.log("Calculating engagement metrics...");
  const stats = {};
  transcript.forEach(t => {
    if (!stats[t.speaker]) {
      stats[t.speaker] = { turns: 0, words: 0 };
    }
    stats[t.speaker].turns += 1;
    stats[t.speaker].words += t.text.split(" ").length;
  });

  const totalWords = Object.values(stats).reduce((total, speakerStats) => total + speakerStats.words, 0);
  if (totalWords === 0) return stats; // Avoid division by zero

  for (let speaker in stats) {
    stats[speaker].speakingShare = parseFloat((stats[speaker].words / totalWords).toFixed(2));
  }

  return stats;
}

/**
 * Master function to process a transcript using a hybrid AI and statistical approach.
 * It runs all analyses in parallel for efficiency.
 * @param {Array<Object>} transcript - Array of objects with {speaker: string, text: string}.
 * @returns {Promise<Object>} An object containing the summary, action items, and engagement stats.
 */
async function generateMom(transcript) {
  // Run all processing tasks concurrently
  const [summary, actions, engagement] = await Promise.all([
    generateAdvancedSummary(transcript),
    extractAdvancedActionItems(transcript),
    engagementMetrics(transcript) // This one is synchronous but works fine in Promise.all
  ]);

  return { summary, actions, engagement };
}

module.exports = { generateMom };

// --- Example Usage ---
// const exampleTranscript = [
//   { speaker: "Alice", text: "Okay team, let's talk about the Q3 marketing plan. We need a solid direction." },
//   { speaker: "Bob", text: "I agree. My team looked at the numbers, and social media is our best bet for engagement." },
//   { speaker: "Alice", text: "Excellent. I will draft the main campaign brief based on that." },
//   { speaker: "Charlie", text: "What's the timeline?" },
//   { speaker: "Bob", text: "I'll need to finalize the budget, which I can get done by Friday." }
// ];

// processTranscript(exampleTranscript).then(result => {
//   console.log(JSON.stringify(result, null, 2));
// });