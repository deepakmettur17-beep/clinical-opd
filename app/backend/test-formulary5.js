const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const cases = [
    {
      name: "CASE 1: Sepsis Temporal Dependency Violation test (Fluid Allergy prevents fluid administration but allows Vasopressor attempt)",
      payload: {
        "visit": {
          "chiefComplaint": "fever and confusion",
          "vitals": { "bp": "70/40", "pulse": 130 },
          "historyAnswers": { "Drug allergy": "IV Fluids" }
        }
      }
    },
    {
      name: "CASE 2: Sepsis Missing Antibiotics Simulation test (Piperacillin and Ceftriaxone allergy hits completeness audit check)",
      payload: {
        "visit": {
          "chiefComplaint": "fever and confusion",
          "vitals": { "bp": "110/60" },
          "historyAnswers": { "Drug allergy": "Piperacillin, Ceftriaxone" }
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
        auditDetails: res.data.auditDetails || "No Audit Dump"
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  fs.writeFileSync('test-formulary5-output.json', JSON.stringify(results, null, 2));
}

runTests();
