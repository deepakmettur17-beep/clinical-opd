const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Sepsis with Shock & Renal Failure (Pip-Taz Avoided, Ceftriaxone used)",
      payload: {
        "visit": {
          "chiefComplaint": "fever and confusion",
          "vitals": { "bp": "80/50", "pulse": 120 },
          "labs": { "lactate": 3.5, "creatinine": 2.8, "egfr": 25 },
          "historyAnswers": { "Past medical history": "kidney disease" }
        }
      }
    },
    {
      name: "CASE 2: STEMI with Active Bleed (Failsafe Triggered)",
      payload: {
        "visit": {
          "chiefComplaint": "chest pain",
          "ecg": { "stElevationLeads": ["V1", "V2", "V3"] },
          "historyAnswers": { "Past medical history": "active GI bleed" }
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
        treatments: res.data.treatments,
        medicationAlerts: res.data.medicationAlerts,
        contraindicationsTriggered: res.data.contraindicationsTriggered
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-formulary3-output.json', JSON.stringify(results, null, 2));
}

runTests();
