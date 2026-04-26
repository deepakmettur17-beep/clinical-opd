const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  
  const cases = [
    {
      name: "CASE 1: STEMI",
      payload: {
        "visit": {
          "chiefComplaint": "chest pain",
          "ecg": { "stElevationLeads": ["V1", "V2", "V3"] }
        }
      }
    },
    {
      name: "CASE 2: Stroke Eligible",
      payload: {
        "visit": {
          "chiefComplaint": "slurred speech",
          "lastSeenNormal": threeHoursAgo
        }
      }
    },
    {
      name: "CASE 3: High Risk Syncope",
      payload: {
        "visit": {
          "chiefComplaint": "fainting",
          "vitals": { "bp": "80/50" }
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
        clinicalSuggestions: res.data.clinicalSuggestions
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-suggestions-output.json', JSON.stringify(results, null, 2));
}

runTests();


