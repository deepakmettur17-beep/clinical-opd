const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Upper GI Bleed (Melena)",
      payload: {
        "visit": {
          "chiefComplaint": "black stool",
          "vitals": { "bp": "110/70", "pulse": 80 }
        }
      }
    },
    {
      name: "CASE 2: Upper GI Bleed w/ Shock",
      payload: {
        "visit": {
          "chiefComplaint": "vomiting blood",
          "vitals": { "bp": "80/50", "pulse": 115 }
        }
      }
    },
    {
      name: "CASE 3: Lower GI Bleed",
      payload: {
        "visit": {
          "chiefComplaint": "rectal bleeding",
          "vitals": { "bp": "120/80", "pulse": 85 }
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
        severity: res.data.severity,
        immediatePlan: res.data.immediatePlan
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-bleeding-output.json', JSON.stringify(results, null, 2));
}

runTests();


