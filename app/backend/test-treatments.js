const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  
  const cases = [
    {
      name: "CASE 1: Sepsis (Weight 80kg)",
      payload: {
        "visit": {
          "chiefComplaint": "fever and confusion",
          "vitals": { "bp": "80/50", "pulse": 120 }
        },
        "patient": {
          "weight": 80
        }
      }
    },
    {
      name: "CASE 2: Stroke Eligible",
      payload: {
        "visit": {
          "chiefComplaint": "slurred speech",
          "lastSeenNormal": threeHoursAgo,
          "vitals": { "bp": "140/90", "pulse": 85 }
        }
      }
    },
    {
      name: "CASE 3: STEMI",
      payload: {
        "visit": {
          "chiefComplaint": "chest pain radiating to jaw",
          "vitals": { "bp": "130/80", "pulse": 90 },
          "ecg": { "stElevationLeads": ["V1", "V2", "V3"] }
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
        medications: res.data.medications
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-treatments-output.json', JSON.stringify(results, null, 2));
}

runTests();
