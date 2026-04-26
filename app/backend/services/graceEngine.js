function calculateGraceScore(visit, patient) {

    let score = 0;
  
    // Age
    if (patient.age >= 80) score += 60;
    else if (patient.age >= 70) score += 50;
    else if (patient.age >= 60) score += 40;
    else if (patient.age >= 50) score += 30;
    else score += 20;
  
    // Heart rate
    if (visit.vitals?.pulse >= 140) score += 40;
    else if (visit.vitals?.pulse >= 120) score += 30;
    else if (visit.vitals?.pulse >= 100) score += 20;
  
    // Systolic BP
    const sbp = parseInt(visit.vitals?.bp?.split("/")[0] || 0);
    if (sbp < 80) score += 50;
    else if (sbp < 90) score += 40;
    else if (sbp < 100) score += 30;
  
    // Creatinine
    if (visit.labs?.creatinine >= 2.5) score += 40;
    else if (visit.labs?.creatinine >= 2) score += 30;
    else if (visit.labs?.creatinine >= 1.5) score += 20;
  
    // Killip class
    if (visit.killipClass === 4) score += 60;
    else if (visit.killipClass === 3) score += 40;
    else if (visit.killipClass === 2) score += 20;
  
    // ST deviation
    if (visit.ecg?.reciprocalChanges) score += 30;
  
    // Troponin
    if (visit.ecg?.troponinPositive) score += 30;
  
    let mortality = "";
  
    if (score < 100) mortality = "<1%";
    else if (score < 150) mortality = "1â€“5%";
    else if (score < 180) mortality = "5â€“15%";
    else mortality = ">20% (Very High Risk)";
  
    return {
      score,
      mortality
    };
  }
  
  module.exports = { calculateGraceScore };