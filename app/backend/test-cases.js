const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Sepsis",
      payload: {
        "visit": {
          "chiefComplaint": "fever",
          "vitals": { "bp": "80/50", "pulse": 120 }
        }
      }
    },
    {
      name: "CASE 2: Acute Heart Failure",
      payload: {
        "visit": {
          "chiefComplaint": "shortness of breath",
          "vitals": { "spo2": 85 }
        }
      }
    },
    {
      name: "CASE 3: Anaphylaxis",
      payload: {
        "visit": {
          "chiefComplaint": "allergic reaction",
          "vitals": { "bp": "75/40" }
        }
      }
    },
    {
      name: "CASE 4: STEMI",
      payload: {
        "visit": {
          "chiefComplaint": "chest pain",
          "ecg": { "stElevationLeads": ["V1", "V2"] }
        }
      }
    }
  ];

  const results = [];
  for (const c of cases) {
    console.log(`\n--- ${c.name} ---`);
    try {
      const res = await axios.post('http://localhost:5000/api/clinical', c.payload);
      const { primaryDiagnosis, confidence, differentials } = res.data;
      results.push({
        name: c.name,
        diagnosis: primaryDiagnosis,
        confidence,
        differentials
      });
    } catch (e) {
      console.error("Error:", e.message);
    }
  }
  fs.writeFileSync('test-output.json', JSON.stringify(results, null, 2));
}

runTests();


