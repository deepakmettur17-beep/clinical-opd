const axios = require('axios');
const fs = require('fs');

async function runTests() {
  const reqId = "c89b88-123-abc-911";
  
  const cases = [
    {
      name: "TEST 1: Input Validation Firewall (Invalid BP = 500/400)",
      payload: {
        requestId: "invalid-bp-999",
        hospitalResources: { icuBeds: 1, ventilators: 1 },
        patients: [
          {
            patientId: "CORRUPT_DATA",
            payload: {
              visit: {
                vitals: { "bp": "500/400" }
              }
            }
          }
        ]
      }
    },
    {
      name: "TEST 2: Normal Valid Request",
      payload: {
        requestId: reqId,
        hospitalResources: { icuBeds: 10, ventilators: 10 },
        patients: [
          {
            patientId: "NORMAL_PATIENT",
            payload: {
              visit: {
                chiefComplaint: "crushing chest pain",
                vitals: { "bp": "110/70" },
                labs: { "troponin": 1.2 }
              }
            }
          }
        ]
      }
    },
    {
      name: "TEST 3: Idempotency Dedup (Push identical RequestId)",
      payload: {
        requestId: reqId,
        hospitalResources: { icuBeds: 99, ventilators: 99 }, // Values shifted, but system should ignore and return cache
        patients: [
          {
            patientId: "NORMAL_PATIENT_DUPED",
            payload: {
              visit: {
                chiefComplaint: "crushing chest pain",
                vitals: { "bp": "110/70" },
                labs: { "troponin": 1.2 }
              }
            }
          }
        ]
      }
    }
  ];

  const results = [];
  for (const c of cases) {
    try {
      const res = await axios.post('http://localhost:5000/api/hospital', c.payload);
      console.log(`\n\n=== ${c.name} ===`);
      console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
      console.error(`\n\n=== ${c.name} (ERROR) ===`);
      console.log(JSON.stringify(e.response ? e.response.data : e.message, null, 2));
    }
  }
}

runTests();


