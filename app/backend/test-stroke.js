const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

  const cases = [
    {
      name: "CASE 1: Acute Stroke (Eligible)",
      payload: {
        "visit": {
          "chiefComplaint": "sudden weakness in right arm",
          "lastSeenNormal": threeHoursAgo,
          "vitals": { "bp": "150/90", "pulse": 80 }
        }
      }
    },
    {
      name: "CASE 2: Acute Stroke (Ineligible)",
      payload: {
        "visit": {
          "chiefComplaint": "slurred speech",
          "lastSeenNormal": fiveHoursAgo,
          "vitals": { "bp": "160/95", "pulse": 85 }
        }
      }
    },
    {
      name: "CASE 3: Stroke (Unknown Onset)",
      payload: {
        "visit": {
          "chiefComplaint": "facial deviation and unable to move",
          "vitals": { "bp": "140/80", "pulse": 90 }
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
        thrombolysisEligible: res.data.thrombolysisEligible,
        timeSinceOnset: res.data.timeSinceOnset,
        oneLineSummary: res.data.oneLineSummary,
        immediatePlan: res.data.immediatePlan,
        disposition: res.data.disposition
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-stroke-output.json', JSON.stringify(results, null, 2));
}

runTests();


