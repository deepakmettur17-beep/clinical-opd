const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Early Shock Tracker Test (MAP 68, Falling trend, Lactate 1.5 Rising, Pulse 110)",
      payload: {
        "visit": {
          "chiefComplaint": "general weakness",
          "vitals": { "bp": "95/55", "pulse": 110 },
          "labs": { "lactate": 1.5 },
          "trends": { "bpTrend": "falling", "lactateTrend": "rising" }
        }
      }
    },
    {
      name: "CASE 2: Impending Respiratory Failure Test (SpO2 93, Falling trend)",
      payload: {
        "visit": {
          "chiefComplaint": "shortness of breath",
          "vitals": { "bp": "110/70", "pulse": 90, "spo2": 93 },
          "trends": { "spo2Trend": "falling" }
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
        diagnosis: res.data.primaryDiagnosis || res.data.error,
        risk: res.data.risk,
        severity: res.data.severity,
        escalation: res.data.escalation
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-formulary7-output.json', JSON.stringify(results, null, 2));
}

runTests();
