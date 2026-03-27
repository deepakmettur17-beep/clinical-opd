const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Critical Trauma (Unconscious + Hypotensive)",
      payload: {
        "visit": {
          "chiefComplaint": "rta, patient is unconscious",
          "vitals": { "bp": "80/50", "pulse": 130, "spo2": 95 }
        }
      }
    },
    {
      name: "CASE 2: Moderate Trauma (Stable Vitals, Conscious)",
      payload: {
        "visit": {
          "chiefComplaint": "fall from standing height, arm injury",
          "vitals": { "bp": "130/80", "pulse": 90, "spo2": 98 }
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
        abcdeStatus: res.data.abcdeStatus,
        disposition: res.data.disposition,
        oneLineSummary: res.data.oneLineSummary
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-trauma-output.json', JSON.stringify(results, null, 2));
}

runTests();
