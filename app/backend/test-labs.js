const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Full Derangement",
      payload: {
        "visit": {
          "chiefComplaint": "weakness",
          "labs": { "hb": 6.5, "creatinine": 2.5, "lactate": 3.1, "wbc": 18000 }
        }
      }
    },
    {
      name: "CASE 2: Partial Derangement",
      payload: {
        "visit": {
          "chiefComplaint": "fever",
          "labs": { "hb": 10, "creatinine": 1.2, "lactate": 1.5, "wbc": 20000 }
        }
      }
    },
    {
      name: "CASE 3: Normal Labs",
      payload: {
        "visit": {
          "chiefComplaint": "chest pain",
          "labs": { "hb": 14, "creatinine": 0.9, "lactate": 1.0, "wbc": 8000 }
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
        labInsights: res.data.labInsights
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-labs-output.json', JSON.stringify(results, null, 2));
}

runTests();
