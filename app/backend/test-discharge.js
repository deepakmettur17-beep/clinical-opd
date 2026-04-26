const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Mild Allergic Reaction (Discharge)",
      payload: {
        "visit": {
          "chiefComplaint": "allergic reaction to peanuts",
          "vitals": { "bp": "110/70", "pulse": 90, "spo2": 99 },
          "labs": { "wbc": 8000 }
        }
      }
    },
    {
      name: "CASE 2: Severe Trauma (Admit ICU)",
      payload: {
        "visit": {
          "chiefComplaint": "rta, unconscious",
          "vitals": { "bp": "80/50", "pulse": 130, "spo2": 85 },
          "labs": { "lactate": 4.0, "hb": 6.0 }
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
        dischargeSummary: res.data.dischargeSummary
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-discharge-output.json', JSON.stringify(results, null, 2));
}

runTests();


