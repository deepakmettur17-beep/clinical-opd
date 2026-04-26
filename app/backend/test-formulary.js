const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Sepsis with Penicillin Allergy (Uses Fallback instead of Pip-Taz)",
      payload: {
        "visit": {
          "chiefComplaint": "fever and confusion",
          "vitals": { "bp": "80/50", "pulse": 120 },
          "historyAnswers": { "Drug allergy": "piperacillin" }
        }
      }
    },
    {
      name: "CASE 2: STEMI with Aspirin Allergy (Avoids Aspirin entirely)",
      payload: {
        "visit": {
          "chiefComplaint": "chest pain",
          "ecg": { "stElevationLeads": ["V1", "V2", "V3"] },
          "historyAnswers": { "Drug allergy": "aspirin" }
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
        medications: res.data.medications
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-formulary-output.json', JSON.stringify(results, null, 2));
}

runTests();


