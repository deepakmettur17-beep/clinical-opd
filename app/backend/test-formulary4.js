const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: STEMI + Active Bleeding (Conflict Escalation)",
      payload: {
        "visit": {
          "chiefComplaint": "chest pain",
          "ecg": { "stElevationLeads": ["V1", "V2", "V3"] },
          "vitals": { "bp": "110/70" },
          "historyAnswers": { "Past medical history": "Active internal bleed" }
        }
      }
    },
    {
      name: "CASE 2: Sepsis + Shock + Multiple Interactions",
      payload: {
        "visit": {
          "chiefComplaint": "fever and confusion",
          "vitals": { "bp": "75/40", "pulse": 130 },
          "labs": { "lactate": 5.0, "creatinine": 1.0, "egfr": 90 }
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
        severity: res.data.severity,
        escalation: res.data.escalation,
        treatments: res.data.treatments,
        medicationAlerts: res.data.medicationAlerts,
        contraindicationsTriggered: res.data.contraindicationsTriggered
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-formulary4-output.json', JSON.stringify(results, null, 2));
}

runTests();


