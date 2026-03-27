function interpretLabs(labs) {
  const labInsights = [];

  if (!labs) return labInsights;

  if (labs.hb !== undefined && labs.hb < 7) {
    labInsights.push("Severe anemia");
  }
  
  if (labs.creatinine !== undefined && labs.creatinine > 2) {
    labInsights.push("Renal impairment");
  }
  
  if (labs.lactate !== undefined && labs.lactate > 2) {
    labInsights.push("Possible shock");
  }
  
  if (labs.wbc !== undefined && labs.wbc > 15000) {
    labInsights.push("Infection / sepsis");
  }

  return labInsights;
}

module.exports = { interpretLabs };
