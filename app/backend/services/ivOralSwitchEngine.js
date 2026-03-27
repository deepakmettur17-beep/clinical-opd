function drugDoseEngine({ drug, weight, creatinineClearance }) {
    let recommendation = "";
  
    if (!drug || !weight) {
      return { recommendation: "Insufficient data for dose calculation" };
    }
  
    // Example: Acyclovir
    if (drug.toLowerCase() === "acyclovir") {
      let dose = 10 * weight; // 10 mg/kg example
      recommendation = `Recommended IV Acyclovir dose: ${dose} mg every 8 hours`;
  
      if (creatinineClearance && creatinineClearance < 50) {
        recommendation += " (Dose adjustment required due to renal impairment)";
      }
    }
  
    // Example: Ceftriaxone
    if (drug.toLowerCase() === "ceftriaxone") {
      let dose = weight < 50 ? "50–75 mg/kg/day" : "1–2 g once daily";
      recommendation = `Ceftriaxone dosing: ${dose}`;
    }
  
    return { recommendation };
  }
  
  module.exports = drugDoseEngine;
  