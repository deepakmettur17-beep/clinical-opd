// Simple Admission Decision Engine

function evaluateAdmission(visit) {
    const justification = [];
    let plan = "OPD";
  
    if (visit.severityLevel === "High") {
      plan = "Admit";
      justification.push("High severity clinical status");
    }
  
    if (visit.labs?.crp > 80) {
      plan = "Admit";
      justification.push("CRP > 80 (Severe inflammation)");
    }
  
    if (visit.vitals?.spo2 < 94) {
      plan = "Admit";
      justification.push("Low oxygen saturation (<94%)");
    }
  
    if (visit.vitals?.pulse > 120) {
      plan = "Admit";
      justification.push("Tachycardia (>120 bpm)");
    }
  
    if (visit.labs?.creatinine > 1.5) {
      plan = "Admit";
      justification.push("Renal impairment");
    }
  
    return {
      plan,
      justification
    };
  }
  
  module.exports = { evaluateAdmission };