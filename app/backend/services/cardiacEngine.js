function evaluateCardiacIntelligence(visit) {

    // ================= STEMI RULE ENGINE =================
    const stElevationLeads = visit.ecg?.stElevationLeads || [];
    const reciprocal = visit.ecg?.reciprocalChanges || false;
  
    if (stElevationLeads.length >= 2) {
      visit.cardiacEmergency = visit.cardiacEmergency || {};
      visit.cardiacEmergency.isSTEMI = true;
      visit.severityLevel = "Critical";
      visit.criticalCare = true;
      visit.admissionPlan = "Immediate PCI";
  
      visit.ruleFlags = visit.ruleFlags || [];
      visit.ruleFlags.push("STEMI – Immediate Reperfusion Required");
    }
  
    // ================= KILLIP CLASSIFICATION =================
    const sbp = visit.vitals?.bp
      ? parseInt(visit.vitals.bp.split("/")[0])
      : null;
  
    const spo2 = visit.vitals?.spo2 || null;
  
    if (sbp && sbp < 90 && spo2 && spo2 < 90) {
      visit.killipClass = 4;
      visit.mortalityRiskEstimate = "Very High (Cardiogenic Shock)";
    } else if (spo2 && spo2 < 92) {
      visit.killipClass = 3;
      visit.mortalityRiskEstimate = "High (Pulmonary Edema)";
    } else {
      visit.killipClass = 1;
      visit.mortalityRiskEstimate = "Low–Moderate";
    }
  
    // ================= DOOR TO BALLOON CALC =================
    if (
      visit.cardiacTimestamps?.erArrivalTime &&
      visit.cardiacTimestamps?.balloonInflationTime
    ) {
      const arrival = new Date(visit.cardiacTimestamps.erArrivalTime);
      const balloon = new Date(visit.cardiacTimestamps.balloonInflationTime);
  
      const diffMs = balloon - arrival;
      visit.doorToBalloonMinutes = Math.floor(diffMs / 60000);
    }
  }
  
  module.exports = { evaluateCardiacIntelligence };