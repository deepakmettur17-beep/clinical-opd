function handleBreathlessness(visit, patient, facility) {
  const spo2 = visit.vitals?.spo2 || 98;

  let diagnosis = "Respiratory Distress - Undifferentiated";
  let differentials = ["Asthma Exacerbation", "Anxiety", "Pneumothorax"];
  let confidence = "Low";
  let severity = "Moderate";
  let treatmentPlan = "Oxygen Therapy as needed";
  let oneLineSummary = "Breathlessness â€“ assess oxygen saturation";
  let immediatePlan = ["Assess airway and breathing", "Check SpO2"];
  let actionChecklist = [];
  let safetyAlerts = [];
  let transferNeeded = false;
  let alerts = [];

  if (spo2 < 90) {
    diagnosis = "Acute Heart Failure / Respiratory Distress";
    differentials = ["Pneumonia", "Pulmonary embolism"];
    confidence = "Moderate";
    severity = "Critical";
    treatmentPlan = "Oxygen & Diuresis";
    oneLineSummary = "Acute Hypoxia/Heart Failure â€“ immediate oxygenation required";
    immediatePlan = [
      "Sit patient upright",
      "Provide supplemental O2 / NIV if needed",
      "Establish IV access",
      "Administer IV loop diuretics (if fluid overloaded)",
      "Consider vasodilators if BP > 110"
    ];
    actionChecklist = [
      { step: 1, action: "Start Oxygen to target SpO2 > 94%", urgency: "Immediate" },
      { step: 2, action: "Give IV Lasix (Furosemide)", urgency: "High" },
      { step: 3, action: "Obtain Chest X-Ray and proBNP", urgency: "High" }
    ];
    safetyAlerts = [
      "Avoid excess fluids",
      "Monitor work of breathing closely"
    ];
  }

  return {
    diagnosis,
    oneLineSummary,
    immediatePlan,
    actionChecklist,
    safetyAlerts,
    confidence,
    differentials,
    severity,
    treatmentPlan,
    transferNeeded,
    alerts
  };
}

module.exports = { handleBreathlessness };