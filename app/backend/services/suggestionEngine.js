function generateSuggestions(diagnosis, severity, vitals, labInsights, extras) {
  let suggestions = [];

  const diagUpper = diagnosis ? diagnosis.toUpperCase() : "";

  if (diagUpper.includes("STEMI") || diagUpper.includes("MYOCARDIAL INFARCTION")) {
    suggestions.push("Activate cath lab immediately");
    suggestions.push("Do ECG if not done");
  } else if (diagUpper.includes("STROKE")) {
    if (extras && extras.thrombolysisEligible) {
      suggestions.push("Start thrombolysis protocol");
    } else {
      suggestions.push("Evaluate for thrombectomy");
    }
  } else if (diagUpper.includes("SEPSIS") || diagUpper.includes("SEPTIC") || diagUpper.includes("INFECTION")) {
    suggestions.push("Send lactate");
    suggestions.push("Start IV fluids immediately");
  } else if (diagUpper.includes("BLEED") || diagUpper.includes("HEMORRHAGE")) {
    suggestions.push("Arrange urgent endoscopy");
    suggestions.push("Prepare blood transfusion");
  } else if (diagUpper.includes("TRAUMA")) {
    suggestions.push("Initiate ABCDE reassessment");
    suggestions.push("Prepare imaging (CT scan)");
  } else if (diagUpper.includes("SYNCOPE")) {
    const isHighRisk = severity === "Critical" || (extras && extras.riskScore && extras.riskScore.riskLevel === "High");
    if (isHighRisk) {
      suggestions.push("Admit for cardiac monitoring");
    } else {
      suggestions.push("Safe discharge with follow-up");
    }
  }

  // Ensure robust filtering max out at 5
  return suggestions.slice(0, 5);
}

module.exports = { generateSuggestions };