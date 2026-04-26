function admissionDecision(visit) {
  const { vitals = {}, labs = {}, severityLevel } = visit;

  const reasons = [];

  if (vitals.spo2 && vitals.spo2 < 94) {
    reasons.push("Low oxygen saturation (<94%)");
  }

  if (vitals.pulse && vitals.pulse > 120) {
    reasons.push("Tachycardia (>120 bpm)");
  }

  if (labs.crp && labs.crp > 80) {
    reasons.push("CRP > 80 (Severe inflammation)");
  }

  if (labs.creatinine && labs.creatinine > 1.7) {
    reasons.push("Renal impairment");
  }

  if (severityLevel === "High") {
    reasons.push("High severity clinical status");
  }

  if (reasons.length > 0) {
    return {
      plan: "Admit",
      justification: reasons
    };
  }

  return {
    plan: "OPD Management",
    justification: ["Stable vitals and labs"]
  };
}

module.exports = admissionDecision;
  


