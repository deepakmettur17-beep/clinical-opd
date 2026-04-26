function triageEngine(vitals) {
    const { pulse, spo2, temperature, bp } = vitals;
  
    let risk = "Low";
    let alerts = [];
  
    const systolic = bp ? parseInt(bp.split("/")[0]) : null;
  
    if (spo2 && spo2 < 92) {
      risk = "Emergency";
      alerts.push("Severe hypoxia");
    }
  
    if (systolic && systolic < 90) {
      risk = "Emergency";
      alerts.push("Severe hypotension");
    }
  
    if (pulse && pulse > 130) {
      risk = "High";
      alerts.push("Severe tachycardia");
    }
  
    if (temperature && temperature > 104) {
      alerts.push("High grade fever");
    }
  
    return { risk, alerts };
  }
  
  module.exports = triageEngine;
  
