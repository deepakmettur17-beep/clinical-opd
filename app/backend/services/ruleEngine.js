const axios = require("axios");

async function generateAISuggestions(data) {
  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" +
        process.env.GEMINI_API_KEY,
      {
        contents: [
          {
            parts: [
              {
                text: `
Return STRICT JSON ONLY.

{
  "provisionalDiagnosis": "",
  "differentials": [],
  "treatmentPlan": "",
  "followUpAdvice": "",
  "redFlagAdvice": "",
  "referralSuggestion": ""
}

Patient Details:
Complaint: ${data.chiefComplaint}
Vitals: ${JSON.stringify(data.vitals)}
Labs: ${JSON.stringify(data.labs)}
`
              }
            ]
          }
        ]
      }
    );

    const text =
      response.data.candidates[0].content.parts[0].text;

    console.log("RAW AI RESPONSE:");
    console.log(text);

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("No JSON returned from AI");
    }

    const jsonString = text.substring(firstBrace, lastBrace + 1);

    return JSON.parse(jsonString);

  } catch (err) {
    console.error("AI ERROR:", err.message);

    return {
      provisionalDiagnosis: "AI unavailable",
      differentials: [],
      treatmentPlan: "",
      followUpAdvice: "",
      redFlagAdvice: "",
      referralSuggestion: ""
    };
  }
}

module.exports = { generateAISuggestions };