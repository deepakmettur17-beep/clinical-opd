const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Hemorrhagic & Severe (3 deficits, BP 190/100)",
      payload: {
        "visit": {
          "chiefComplaint": "weakness in arm, facial droop, slurred speech",
          "vitals": { "bp": "190/100", "pulse": 85 }
        }
      }
    },
    {
      name: "CASE 2: Ischemic & Eligible (1 deficit, BP 140/80)",
      payload: {
        "visit": {
          "chiefComplaint": "arm weakness",
          "lastSeenNormal": new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          "vitals": { "bp": "140/80", "pulse": 80 }
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
        neurologicalSeverity: res.data.neurologicalSeverity,
        strokeTypeSuggestion: res.data.strokeTypeSuggestion,
        contraindicationsCheck: res.data.contraindicationsCheck,
        doorToNeedleTarget: res.data.doorToNeedleTarget,
        oneLineSummary: res.data.oneLineSummary
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-stroke-advanced-output.json', JSON.stringify(results, null, 2));
}

runTests();
