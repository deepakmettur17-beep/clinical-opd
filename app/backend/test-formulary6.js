const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Acute Septic Shock w/ ARDS (SpO2 82, MAP < 65, Lactate 5.0)",
      payload: {
        "visit": {
          "chiefComplaint": "fever and confusion",
          "vitals": { "bp": "70/40", "pulse": 130, "spo2": 82 },
          "labs": { "lactate": 5.0 }
        },
        "patient": { "weight": 80 }
      }
    },
    {
      name: "CASE 2: Undifferentiated Shock w/ Moderate Hypoxia (SpO2 88, MAP < 65, Lactate 1.5)",
      payload: {
        "visit": {
          "chiefComplaint": "chest pain and fatigue",
          "vitals": { "bp": "75/40", "pulse": 110, "spo2": 88 },
          "labs": { "lactate": 1.5 }
        },
        "patient": { "weight": 70 }
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
        shockType: res.data.shockType,
        ventilation: res.data.ventilation,
        escalation: res.data.escalation,
        treatments: res.data.treatments
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-formulary6-output.json', JSON.stringify(results, null, 2));
}

runTests();


