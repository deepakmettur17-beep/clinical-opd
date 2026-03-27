function labDecisionEngine(labs) {
    let alerts = [];
    let recommendations = [];
    let admissionFlag = false;
  
    // Neutrophils threshold
    if (labs.neutrophils && labs.neutrophils > 80) {
      alerts.push("Neutrophilia > 80%");
      recommendations.push("Strongly consider continuing antibiotics");
    }
  
    // CRP threshold
    if (labs.crp && labs.crp > 50) {
      alerts.push("CRP > 50 mg/L");
      recommendations.push("Likely active bacterial infection — continue IV antibiotics");
    }
  
    // Liver enzymes
    if (labs.ast && labs.alt) {
      if (labs.ast > 5 * labs.astUpperLimit || labs.alt > 5 * labs.altUpperLimit) {
        alerts.push("Severe transaminitis (>5× ULN)");
        recommendations.push("Consider hospital admission");
        admissionFlag = true;
      }
    }
  
    // Creatinine rising
    if (labs.creatinineTrend === "rising") {
      alerts.push("Rising creatinine");
      recommendations.push("Initiate IV hydration");
      recommendations.push("Avoid nephrotoxic oral medications");
      recommendations.push("Switch to IV therapy if needed");
    }
  
    return {
      labAlerts: alerts,
      labRecommendations: recommendations,
      labAdmissionFlag: admissionFlag
    };
  }
  
  module.exports = labDecisionEngine;
  