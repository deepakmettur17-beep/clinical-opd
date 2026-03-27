const pharmacyService = require('./app/backend/services/pharmacyService');
const drugMasterService = require('./app/backend/services/drugMasterService');
const { deriveMedications } = require('./app/backend/services/treatmentEngine');
const path = require('path');

async function test() {
  console.log("--- PHARMACY SYNC TEST ---");
  const amaryl = pharmacyService.getBrandDetails('Amaryl');
  console.log("Amaryl Sync:", amaryl.status, "Generic:", amaryl.genericName);

  const newBrand = pharmacyService.getBrandDetails('NewBrand-X');
  console.log("NewBrand-X Sync:", newBrand.status, "(Expected: UNMAPPED)");

  console.log("\n--- CLASS DUPLICATION TEST ---");
  // Simulating patient on Amaryl (Glimepiride - Sulfonylurea)
  // Trying to add GPride (Glimepiride - Sulfonylurea)
  const alert = drugMasterService.checkClassDuplication(['Glimepiride'], 'Glimepiride');
  console.log("Duplication Alert:", alert);

  console.log("\n--- STOCK-AWARE TREATMENT TEST ---");
  const patientData = {
    diagnosis: "STEMI",
    vitals: { bp: "120/80", pulse: 80, spo2: 98 },
    trends: {},
    allergies: ""
  };

  const results = deriveMedications(patientData);
  console.log("Treatments generated:", results.treatments.map(t => t.drug));
  console.log("Alerts:", results.medicationAlerts);
}

test().catch(console.error);
