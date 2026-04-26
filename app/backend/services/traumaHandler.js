function handleTrauma(visit, patient, facility) {
  const parseBP = (bpStr) => {
    if (!bpStr) return { sys: 120, dia: 80 };
    const [sys, dia] = bpStr.split('/');
    return { sys: parseInt(sys) || 0, dia: parseInt(dia) || 0 };
  };

  const complaintStr = visit.chiefComplaint ? visit.chiefComplaint.toLowerCase() : "";
  const sysBP = visit.vitals?.bp ? parseBP(visit.vitals.bp).sys : 120;
  const pulse = visit.vitals?.pulse || 80;
  const spo2 = visit.vitals?.spo2 || 98;
  
  // ABCDE Assessment
  const isUnconscious = complaintStr.includes("unconscious") || complaintStr.includes("altered sensorium");
  const airwayRisk = isUnconscious;
  const breathingRisk = spo2 < 90;
  const circulationRisk = sysBP < 90 || pulse > 120;
  const disabilityRisk = isUnconscious;
  const exposureRisk = true;
  
  const abcdeStatus = {
    airway: airwayRisk,
    breathing: breathingRisk,
    circulation: circulationRisk,
    disability: disabilityRisk,
    exposure: exposureRisk
  };

  let severity = "Moderate";
  let triageLevel = "ORANGE";
  let disposition = "Observation";
  
  if (airwayRisk || breathingRisk || circulationRisk) {
    severity = "Critical";
    triageLevel = "RED";
    disposition = "Admit ICU / Emergency Surgery";
  }

  let diagnosis = "Trauma";
  let timeToAction = "Immediate";
  
  let oneLineSummary = severity === "Critical" 
    ? "Major trauma with ABC compromise â€“ immediate resuscitation required"
    : "Trauma evaluation â€“ stabilize and assess for isolated injuries";

  let immediatePlan = [
    "Secure airway",
    "Provide oxygen",
    "Control bleeding",
    "Establish IV access",
    "Prepare for imaging / surgery"
  ];
  
  let actionChecklist = [
    { step: 1, action: "Primary Survey (ABCDE)", urgency: "Immediate" },
    { step: 2, action: "Secondary Survey", urgency: "High" }
  ];

  let safetyAlerts = [
    "Do not miss internal bleeding",
    "Monitor airway continuously",
    "Reassess ABCDE frequently"
  ];

  let monitoringPlan = [
    "Continuous vitals",
    "Frequent neuro checks if head injury suspected"
  ];

  // Return standard api format alongside the specific custom objects
  return {
    diagnosis,
    severity,
    triageLevel,
    timeToAction,
    abcdeStatus,
    oneLineSummary,
    immediatePlan,
    actionChecklist,
    safetyAlerts,
    monitoringPlan,
    disposition
  };
}

module.exports = { handleTrauma };