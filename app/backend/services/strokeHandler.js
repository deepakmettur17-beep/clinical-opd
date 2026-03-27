function handleStroke(visit, patient, facility) {
  const parseBP = (bpStr) => {
    if (!bpStr) return { sys: 120, dia: 80 };
    const [sys, dia] = bpStr.split('/');
    return { sys: parseInt(sys) || 0, dia: parseInt(dia) || 0 };
  };

  const sysBP = visit.vitals?.bp ? parseBP(visit.vitals.bp).sys : 120;
  const complaintStr = visit.chiefComplaint ? visit.chiefComplaint.toLowerCase() : "";

  let diagnosis = "Suspected Stroke / TIA";
  let confidence = "High";
  let severity = "Moderate";
  let triageLevel = "RED";
  let timeToAction = "Immediate";
  let disposition = "Admit ICU";
  
  let oneLineSummary = "Acute neurological deficit – activate stroke protocol";
  let actionChecklist = [
    { step: 1, action: "Urgent non-contrast CT Head", urgency: "Immediate" },
    { step: 2, action: "Neurology/Stroke Consult", urgency: "Immediate" }
  ];
  
  let monitoringPlan = [
    "Neuro checks every 15 minutes",
    "Continuous cardiac telemetry",
    "Monitor blood pressure (per stroke guidelines)"
  ];

  let safetyAlerts = [
    "Do not delay CT scan",
    "Exclude hemorrhage before thrombolysis",
    "Monitor airway and consciousness"
  ];
  
  let immediatePlan = [
    "Activate stroke code",
    "Check blood glucose",
    "Obtain CT brain urgently",
    "Establish IV access"
  ];
  
  let differentials = [
    { name: "Ischemic Stroke", priority: "High" },
    { name: "Hemorrhagic Stroke", priority: "High" },
    { name: "Transient Ischemic Attack (TIA)", priority: "Moderate" },
    { name: "Hypoglycemia", priority: "Moderate" },
    { name: "Todd's Paralysis / Seizure", priority: "Low" }
  ];

  const face = complaintStr.includes("facial") || complaintStr.includes("face") || complaintStr.includes("droop");
  const arm = complaintStr.includes("weakness") || complaintStr.includes("unable to move") || complaintStr.includes("arm") || complaintStr.includes("leg");
  const speech = complaintStr.includes("slur") || complaintStr.includes("speech") || complaintStr.includes("speak");
  
  const hasNeuroDeficit = face || arm || speech || complaintStr.includes("stroke");

  if (hasNeuroDeficit) {
    severity = "Critical";
    diagnosis = "Acute Stroke";
  }

  // Calculate neurologicalSeverity
  let deficitCount = 0;
  if (face) deficitCount++;
  if (arm) deficitCount++;
  if (speech) deficitCount++;

  let neurologicalSeverity = "Mild";
  if (deficitCount >= 2) {
    neurologicalSeverity = "Severe";
  } else if (deficitCount === 1) {
    neurologicalSeverity = "Moderate";
  }

  // Calculate strokeTypeSuggestion
  let strokeTypeSuggestion = "Likely Ischemic (pending CT)";
  if (sysBP > 180 || complaintStr.includes("headache") || complaintStr.includes("vomiting")) {
    strokeTypeSuggestion = "Possible Hemorrhagic – urgent CT required";
  }

  let contraindicationsCheck = [
    "Check recent surgery",
    "Check active bleeding",
    "Check anticoagulant use"
  ];

  let doorToNeedleTarget = "< 60 minutes";

  let thrombolysisEligible = false;
  let timeSinceOnset = null;

  if (visit.lastSeenNormal) {
    const lastSeenTime = new Date(visit.lastSeenNormal);
    const currentTime = new Date();
    
    timeSinceOnset = Math.floor((currentTime - lastSeenTime) / 60000);
    
    if (timeSinceOnset > 0 && timeSinceOnset <= 270) {
      thrombolysisEligible = true;
      immediatePlan.push("Prepare thrombolysis if eligible");
    } else {
      immediatePlan.push("Assess for endovascular thrombectomy (EVT) eligibility");
    }
  } else {
    immediatePlan.push("Clarify 'last seen normal' time");
  }

  if (thrombolysisEligible) {
    oneLineSummary = "Acute stroke within thrombolysis window – activate stroke protocol immediately";
  } else {
    oneLineSummary = "Acute stroke outside thrombolysis window – evaluate for thrombectomy";
  }
  
  immediatePlan = immediatePlan.slice(0, 5);

  return {
    diagnosis,
    severity,
    triageLevel,
    timeToAction,
    thrombolysisEligible,
    timeSinceOnset,
    oneLineSummary,
    immediatePlan,
    actionChecklist,
    safetyAlerts,
    monitoringPlan,
    disposition,
    confidence,
    differentials,
    strokeTypeSuggestion,
    contraindicationsCheck,
    doorToNeedleTarget,
    neurologicalSeverity
  };
}

module.exports = { handleStroke };
