process.on('uncaughtException', (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.stack);
});

try {
  const { deriveMedications } = require('./app/backend/services/treatmentEngine');
  const patientData = {
    diagnosis: "STEMI",
    vitals: { bp: "120/80", pulse: 80, spo2: 98 },
    trends: {},
    allergies: ""
  };
  console.log("Starting deriveMedications...");
  const results = deriveMedications(patientData);
  console.log("Results:", JSON.stringify(results, null, 2));
} catch (e) {
  console.error("SYNC ERROR:", e.stack);
}
