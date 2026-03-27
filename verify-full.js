const { deriveMedications } = require('./app/backend/services/treatmentEngine');
const pharmacyService = require('./app/backend/services/pharmacyService');

try {
  console.log("--- STOCK-AWARE TREATMENT TEST ---");
  const patientData = {
    diagnosis: "STEMI",
    vitals: { bp: "120/80", pulse: 80, spo2: 98 },
    trends: {},
    allergies: ""
  };

  // Check Ecosprin stock (should be 200)
  const ecosprin = pharmacyService.getBrandDetails('Ecosprin');
  console.log("Ecosprin stock:", ecosprin?.stockCount);

  const results = deriveMedications(patientData);
  console.log("Treatments generated count:", results.treatments.length);
  results.treatments.forEach(t => console.log(`Drug: ${t.drug}, Action: ${t.reason}`));
} catch (e) {
  console.error("DERIVE ERROR:", e);
}
