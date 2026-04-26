const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Perfect History (No Missing)",
      payload: {
        "visit": {
          "chiefComplaint": "chest pain",
          "vitals": { "bp": "120/80", "pulse": 80 },
          "historyAnswers": {
            "onset": "sudden",
            "duration": "2 hours",
            "progression": "worsening",
            "severity": "10/10",
            "aggravating factors": "exertion",
            "relieving factors": "rest",
            "radiation": "left arm",
            "nature of pain": "crushing",
            "syncope": "no",
            "hypotension": "no"
          }
        }
      }
    },
    {
      name: "CASE 2: Missing Core & Red Flags",
      payload: {
        "visit": {
          "chiefComplaint": "fainting episode",
          "vitals": { "bp": "110/70", "pulse": 70 },
          "historyAnswers": [
            "onset",
            "duration",
            "severity"
          ]
        }
      }
    }
  ];

  const results = [];
  for (const c of cases) {
    try {
      const res = await axios.post('http://localhost:5000/api/clinical', c.payload);
      results.push({
        name: c.name,
        diagnosis: res.data.primaryDiagnosis,
        missingCriticalQuestions: res.data.missingCriticalQuestions
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-history-validator-output.json', JSON.stringify(results, null, 2));
}

runTests();


