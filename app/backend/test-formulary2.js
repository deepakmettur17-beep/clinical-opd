const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Sepsis with Piperacillin Allergy",
      payload: {
        "visit": {
          "chiefComplaint": "fever and confusion",
          "vitals": { "bp": "80/50", "pulse": 120 },
          "historyAnswers": { "Drug allergy": "piperacillin" }
        }
      }
    },
    {
      name: "CASE 2: STEMI with Aspirin Allergy",
      payload: {
        "visit": {
          "chiefComplaint": "chest pain",
          "ecg": { "stElevationLeads": ["V1", "V2", "V3"] },
          "historyAnswers": { "Drug allergy": "aspirin" }
        }
      }
    },
    {
      name: "CASE 3: Normal Trauma",
      payload: {
        "visit": {
          "chiefComplaint": "trauma from fall",
          "vitals": { "bp": "80/50", "pulse": 130 }
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
  fs.writeFileSync('test-formulary2-output.json', JSON.stringify(results, null, 2));
}

runTests();
