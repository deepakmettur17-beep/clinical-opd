function applyKillipMortality(visit) {

    if (!visit.killipClass) return;
  
    switch (visit.killipClass) {
  
      case 1:
        visit.killipMortalityPercent = "~5%";
        break;
  
      case 2:
        visit.killipMortalityPercent = "~10%";
        break;
  
      case 3:
        visit.killipMortalityPercent = "~20%";
        visit.criticalCare = true;
        break;
  
      case 4:
        visit.killipMortalityPercent = "40â€“60% (Cardiogenic Shock)";
        visit.criticalCare = true;
        visit.severityLevel = "Critical";
        break;
  
      default:
        visit.killipMortalityPercent = "";
    }
  }
  
  module.exports = { applyKillipMortality };