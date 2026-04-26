function handleFever(visit, patient, facility) {
  const parseBP = (bpStr) => {
    if (!bpStr) return { sys: 120, dia: 80 };
    const [sys, dia] = bpStr.split('/');
    return { sys: parseInt(sys) || 0, dia: parseInt(dia) || 0 };
  };

  const sysBP = visit.vitals?.bp ? parseBP(visit.vitals.bp).sys : 120;
  const pulse = visit.vitals?.pulse || 80;

  let diagnosis = "Febrile Illness / Suspected Infection";
  let differentials = ["Viral syndrome", "UTI", "Respiratory infection"];
  let confidence = "Low";
  let severity = "Low";
  let treatmentPlan = "Antipyretics and further evaluation";
  let oneLineSummary = "Fever â€“ check source of infection";
  let immediatePlan = ["Obtain full set of vitals"];
  let actionChecklist = [];
  let safetyAlerts = [];
  let transferNeeded = false;
  let alerts = [];

  if (sysBP < 90 && pulse > 100) {
    diagnosis = "Sepsis / Septic Shock";
    differentials = ["Anaphylaxis", "Cardiogenic shock"];
    confidence = "High";
    severity = "Critical";
    treatmentPlan = "Immediate Fluid Resuscitation and Antibiotics";
    oneLineSummary = "Probable Sepsis â€“ urgent fluids and antibiotics required";
    immediatePlan = [
      "Obtain IV access (2 large bore)",
      "Draw blood cultures & lactate",
      "Administer broad-spectrum IV antibiotics",
      "Start 30mL/kg IV crystalloid fluid bolus",
      "Monitor closely for ICU transfer"
    ];
    actionChecklist = [
      { step: 1, action: "Draw Blood Cultures", urgency: "Immediate" },
      { step: 2, action: "Administer IV Antibiotics", urgency: "Immediate" },
      { step: 3, action: "Administer IV Fluids", urgency: "High" }
    ];
    safetyAlerts = [
      "Do not delay antibiotics beyond 1 hour",
      "Reassess BP frequently during fluid bolus"
    ];
    if (!facility.hasICU) {
       transferNeeded = true;
       alerts.push("Consider transfer to facility with ICU capabilities if non-responsive to fluids.");
    }
  }

  return {
    diagnosis,
    oneLineSummary,
    immediatePlan,
    actionChecklist,
    safetyAlerts,
    confidence,
    differentials,
    severity,
    treatmentPlan,
    transferNeeded,
    alerts
  };
}

module.exports = { handleFever };