const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Bleeding w/ Cirrhosis (Stable)",
      payload: {
        "visit": {
          "chiefComplaint": "vomiting blood, patient has liver cirrhosis",
          "vitals": { "bp": "110/70", "pulse": 80 }
        }
      }
    },
    {
      name: "CASE 2: Massive GI Bleed (Unstable)",
      payload: {
        "visit": {
          "chiefComplaint": "hematemesis",
          "vitals": { "bp": "80/50", "pulse": 110 }
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
        triageLevel: res.data.triageLevel,
        timeToAction: res.data.timeToAction,
        differentials: res.data.differentials,
        monitoringPlan: res.data.monitoringPlan
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-bleeding2-output.json', JSON.stringify(results, null, 2));
}

runTests();
