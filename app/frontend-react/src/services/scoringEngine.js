function scoringEngine(vitals) {
    const { pulse, spo2, temperature, bp } = vitals;
  
    let score = 0;
    const systolic = bp ? parseInt(bp.split("/")[0]) : null;
  
    if (pulse > 110) score += 2;
    if (spo2 < 94) score += 2;
    if (systolic && systolic < 100) score += 2;
    if (temperature > 102) score += 1;
  
    let level = "Low";
  
    if (score >= 5) level = "High";
    else if (score >= 3) level = "Moderate";
  
    return { score, level };
  }
  
  module.exports = scoringEngine;
  
