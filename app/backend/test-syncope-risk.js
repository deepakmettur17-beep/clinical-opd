const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: High Risk (History + Abnormal ECG + SOB)",
      payload: {
        "visit": {
          "chiefComplaint": "syncope, shortness of breath",
          "medicalHistory": "heart disease",
          "ecg": { "isAbnormal": true },
          "vitals": { "bp": "110/70", "pulse": 80 }
        }
      }
    },
    {
      name: "CASE 2: Moderate Risk (Just SBP < 90)",
      payload: {
        "visit": {
          "chiefComplaint": "syncope",
          "medicalHistory": "none",
          "vitals": { "bp": "85/60", "pulse": 90 }
        }
      }
    },
    {
      name: "CASE 3: Low Risk (Unremarkable)",
      payload: {
        "visit": {
          "chiefComplaint": "fainting after pain",
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
        riskScore: res.data.riskScore,
        disposition: res.data.disposition,
        oneLineSummary: res.data.oneLineSummary
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-syncope-risk-output.json', JSON.stringify(results, null, 2));
}

runTests();
