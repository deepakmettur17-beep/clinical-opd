const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateAISuggestions({ complaint, vitals, labs }) {
  const prompt = `
You are a clinical decision support AI.

Complaint: ${complaint}

Vitals:
Temperature: ${vitals?.temperature}
Pulse: ${vitals?.pulse}
SpO2: ${vitals?.spo2}

Labs:
Neutrophils: ${labs?.neutrophils}
CRP: ${labs?.crp}
AST: ${labs?.ast}
ALT: ${labs?.alt}
Creatinine trend: ${labs?.creatinine_trend}

Provide:
1. Possible diagnosis
2. Admission risk
3. Treatment plan
4. Red flags
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a senior clinical reasoning AI." },
      { role: "user", content: prompt }
    ],
    temperature: 0.3,
  });

  return response.choices[0].message.content;
}

module.exports ={ generateAISuggestions };