const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Cardiac Syncope",
      payload: {
        "visit": {
          "chiefComplaint": "sudden collapse",
          "vitals": { "bp": "110/70", "pulse": 80 }
        }
      }
    },
    {
      name: "CASE 2: Vasovagal Syncope",
      payload: {
        "visit": {
          "chiefComplaint": "fainting after seeing blood, felt dizzy",
          "vitals": { "bp": "100/60", "pulse": 90 }
        }
      }
    },
    {
      name: "CASE 3: Orthostatic Syncope",
      payload: {
        "visit": {
          "chiefComplaint": "syncope upon standing up",
          "vitals": { "bp": "120/80", "pulse": 85 }
        }
      }
    },
    {
      name: "CASE 4: Undifferentiated Unstable",
      payload: {
        "visit": {
          "chiefComplaint": "syncope",
          "vitals": { "bp": "80/50", "pulse": 115 }
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
        hemodynamicStatus: res.data.hemodynamicStatus
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-syncope-output.json', JSON.stringify(results, null, 2));
}

runTests();
