const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const payload = {
    hospitalResources: {
      icuBeds: 1,
      ventilators: 1
    },
    patients: [
      {
        patientId: "PATIENT_A_SEPSIS_ARDS",
        payload: {
          visit: {
            chiefComplaint: "fever and confusion",
            vitals: { "bp": "70/40", "pulse": 130, "spo2": 82 },
            labs: { "lactate": 5.0 }
          },
          patient: { weight: 80 }
        }
      },
      {
        patientId: "PATIENT_B_EARLY_SHOCK",
        payload: {
          visit: {
            chiefComplaint: "general weakness",
            vitals: { "bp": "95/55", "pulse": 115 },
            labs: { "lactate": 1.5 },
            trends: { "bpTrend": "falling", "lactateTrend": "rising" }
          }
        }
      },
      {
        patientId: "PATIENT_C_STEMI",
        payload: {
          visit: {
            chiefComplaint: "crushing chest pain",
            vitals: { "bp": "110/70" },
            labs: { "troponin": 1.2 }
          }
        }
      },
      {
        patientId: "PATIENT_D_STABLE",
        payload: {
          visit: {
            chiefComplaint: "mild headache",
            vitals: { "bp": "120/80" }
          }
        }
      }
    ]
  };

  try {
    const res = await axios.post('http://localhost:5000/api/hospital', payload);
    fs.writeFileSync('test-hospital-output.json', JSON.stringify(res.data, null, 2));
    console.log("Hospital OS Triage Execution Complete.");
  } catch (e) {
    console.error(e.message);
  }
}

runTests();
