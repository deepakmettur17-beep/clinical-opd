const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Chest Pain",
      payload: {
        "visit": {
          "chiefComplaint": "severe chest pain radiating to left arm",
          "vitals": { "bp": "110/70", "pulse": 90 }
        }
      }
    },
    {
      name: "CASE 2: Fever & Breathlessness",
      payload: {
        "visit": {
          "chiefComplaint": "high fever and shortness of breath",
          "vitals": { "bp": "100/60", "pulse": 110, "spo2": 88 }
        }
      }
    },
    {
      name: "CASE 3: Syncope",
      payload: {
        "visit": {
          "chiefComplaint": "fainting episode",
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
        historyTemplate: res.data.historyTemplate
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-history-output.json', JSON.stringify(results, null, 2));
}

runTests();


