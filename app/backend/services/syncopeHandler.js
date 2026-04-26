function handleSyncope(visit, patient, facility) {
  const parseBP = (bpStr) => {
    if (!bpStr) return { sys: 120, dia: 80 };
    const [sys, dia] = bpStr.split('/');
    return { sys: parseInt(sys) || 0, dia: parseInt(dia) || 0 };
  };

  const sysBP = visit.vitals?.bp ? parseBP(visit.vitals.bp).sys : 120;
  const complaintStr = visit.chiefComplaint ? visit.chiefComplaint.toLowerCase() : "";
  const historyStr = visit.medicalHistory ? visit.medicalHistory.toLowerCase() : "";

  let type = "Vasovagal"; 
  let diagnosis = "Syncope (Undifferentiated)";
  let confidence = "Low";
  let differentials = [
    { name: "Vasovagal Syncope", priority: "Moderate" },
    { name: "Cardiac Arrhythmia", priority: "Low" },
    { name: "Orthostatic Hypotension", priority: "Low" }
  ];
  let oneLineSummary = "Syncope episode â€“ requires evaluation";
  let immediatePlan = ["Place patient in supine position", "Check vitals", "Obtain 12-lead ECG"];
  let actionChecklist = [];
  let safetyAlerts = [];
  let monitoringPlan = ["Continuous telemetry / ECG", "Frequent BP checks"];
  let severity = "Moderate";
  let hemodynamicStatus = "Stable";
  let triageLevel = "ORANGE";
  let timeToAction = "Within 1 hour";

  const isSudden = complaintStr.includes("sudden") || complaintStr.includes("no warning") || complaintStr.includes("without warning") || complaintStr.includes("no prodrome");
  const hasHeartDisease = historyStr.includes("heart disease") || historyStr.includes("arrhythmia") || historyStr.includes("heart failure") || historyStr.includes("cardiac");
  const abnormalECG = visit.ecg?.isAbnormal === true || (visit.ecg?.findings && visit.ecg.findings.length > 0);

  const isOrthostatic = complaintStr.includes("standing") || complaintStr.includes("getting up") || complaintStr.includes("postural");
  const isVasovagal = complaintStr.includes("pain") || complaintStr.includes("stress") || complaintStr.includes("dizzy") || complaintStr.includes("sweating") || complaintStr.includes("hot");

  if (isSudden || hasHeartDisease || abnormalECG) {
    type = "Cardiac";
    diagnosis = "Cardiac Syncope";
    differentials = [
      { name: "Ventricular Arrhythmia", priority: "High" },
      { name: "Structural Heart Disease (AS/HOCM)", priority: "High" },
      { name: "Heart Block", priority: "High" }
    ];
    confidence = "Moderate";
    oneLineSummary = "High-risk syncope â€“ rule out dangerous arrhythmias";
    immediatePlan = [
      "Immediate 12-lead ECG and continuous telemetry",
      "Establish IV access and draw troponin/BNP",
      "Keep patient strictly in bed",
      "Prepare for possible resus/pacing"
    ];
    actionChecklist = [
      { step: 1, action: "Admit to telemetry or ICU", urgency: "Immediate" },
      { step: 2, action: "Cardiology Consult", urgency: "High" }
    ];
    safetyAlerts = ["High risk of sudden cardiac death, continuous monitoring required."];
  } else if (isOrthostatic) {
    type = "Orthostatic";
    diagnosis = "Orthostatic Syncope";
    differentials = [
      { name: "Dehydration/Volume Depletion", priority: "High" },
      { name: "Medication-induced (e.g., antihypertensives)", priority: "High" },
      { name: "Autonomic Neuropathy", priority: "Moderate" }
    ];
    confidence = "Moderate";
    oneLineSummary = "Orthostatic syncope â€“ evaluate fluid status and medications";
    immediatePlan = [
      "Check orthostatic vitals",
      "Consider IV fluids if volume depleted",
      "Review current medications",
      "Educate patient on slow postural changes"
    ];
    actionChecklist = [
      { step: 1, action: "Orthostatic BP Measurement", urgency: "Normal" },
      { step: 2, action: "Medication Reconciliation", urgency: "Normal" }
    ];
    safetyAlerts = ["Fall risk â€“ assist patient when mobilized."];
  } else {
    type = isVasovagal ? "Vasovagal" : "Undifferentiated";
    diagnosis = isVasovagal ? "Vasovagal Syncope" : "Syncope (Undifferentiated)";
    differentials = [
      { name: "Vasovagal/Reflex Syncope", priority: "High" },
      { name: "Orthostatic Hypotension", priority: "Moderate" },
      { name: "Cardiac Arrhythmia", priority: "Low" }
    ];
    confidence = isVasovagal ? "High" : "Low";
    oneLineSummary = isVasovagal ? "Vasovagal syncope â€“ reassure and monitor" : "Undifferentiated syncope â€“ complete basic workup";
    immediatePlan = [
      "Reassure patient and keep supine",
      "Oral hydration if tolerated",
      "Perform basic ECG to rule out cardiac causes"
    ];
    actionChecklist = [
      { step: 1, action: "Obtain ECG", urgency: "Normal" },
      { step: 2, action: "Observe until fully asymptomatic", urgency: "Normal" }
    ];
    safetyAlerts = ["Stand patient slowly to prevent secondary falls."];
  }

  if (type === "Cardiac") {
    severity = "Critical";
    triageLevel = "RED";
    timeToAction = "Immediate";
  } else {
    severity = "Moderate";
    triageLevel = "ORANGE";
    timeToAction = "Within 1 hour";
  }

  // Risk Score Logic
  let score = 0;
  let reason = [];

  if (historyStr.includes("heart disease")) {
    score += 1;
    reason.push("History of heart disease");
  }
  if (abnormalECG) {
    score += 1;
    reason.push("Abnormal ECG");
  }
  if (sysBP < 90) {
    score += 1;
    reason.push("Systolic BP < 90");
  }
  if (complaintStr.includes("breathlessness") || complaintStr.includes("shortness of breath")) {
    score += 1;
    reason.push("Associated breathlessness");
  }

  let riskLevel = "Low";
  if (score >= 2) riskLevel = "High";
  else if (score === 1) riskLevel = "Moderate";

  const riskScore = {
    score,
    riskLevel,
    reason
  };

  // Disposition
  let disposition = "Observe";
  if (diagnosis === "Cardiac Syncope" || riskLevel === "High") {
    disposition = "Admit";
  } else if (riskLevel === "Low") {
    disposition = "Discharge";
  }

  // Update oneLineSummary
  if (riskLevel === "High") {
    oneLineSummary = "High-risk syncope â€“ requires admission and cardiac evaluation";
  } else if (riskLevel === "Low") {
    oneLineSummary = "Likely benign syncope â€“ safe for discharge with advice";
  }

  if (sysBP < 90) {
    hemodynamicStatus = "Unstable";
  } else {
    hemodynamicStatus = "Stable";
  }

  return {
    diagnosis,
    severity,
    oneLineSummary,
    immediatePlan,
    actionChecklist,
    safetyAlerts,
    triageLevel,
    timeToAction,
    monitoringPlan,
    confidence,
    differentials,
    hemodynamicStatus,
    riskScore,
    disposition
  };
}

module.exports = { handleSyncope };