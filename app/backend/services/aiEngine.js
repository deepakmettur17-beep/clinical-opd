async function generateAIDraft(visit, facility) {

  const flags = [];
  const admissionReasons = [];
  let severity = "Low";
  let admissionPlan = "Outpatient";

  const { vitals = {}, labs = {} } = visit;

  /* =========================================
     SHOCK + qSOFA DETECTION
  ========================================== */

  let qsofa = 0;

  // Respiratory rate not yet stored → optional future
  // Hypotension (SBP ≤100)
  if (vitals.bp) {
    const [sys] = vitals.bp.split("/").map(Number);
    if (sys && sys <= 100) {
      qsofa++;
      flags.push("Hypotension (SBP ≤100)");
      admissionReasons.push("Hypotension");
    }
  }

  // Tachycardia
  if (vitals.pulse && vitals.pulse > 120) {
    flags.push("Tachycardia >120");
    admissionReasons.push("Tachycardia");
  }

  // Hypoxia
  if (vitals.spo2 && vitals.spo2 < 94) {
    flags.push("Low oxygen saturation");
    admissionReasons.push("Hypoxia");
  }

  // Inflammatory markers
  if (labs.neutrophils && labs.neutrophils > 80) {
    flags.push("Neutrophilia >80%");
    admissionReasons.push("Severe bacterial response");
  }

  if (labs.crp && labs.crp > 50) {
    flags.push("CRP >50");
    admissionReasons.push("Severe inflammation");
  }

  if (labs.creatinine && labs.creatinine > 1.5) {
    flags.push("Renal impairment");
    admissionReasons.push("Renal dysfunction");
  }

 /* =========================================
   SEVERITY ESCALATION LOGIC
========================================== */

let icuTrigger = false;

// ICU criteria
if (vitals.bp) {
  const [sys] = vitals.bp.split("/").map(Number);
  if (sys && sys < 90) {
    icuTrigger = true;
  }
}

if (vitals.spo2 && vitals.spo2 < 90) {
  icuTrigger = true;
}

if (labs.creatinine && labs.creatinine >= 2) {
  icuTrigger = true;
}

if (labs.crp && labs.crp >= 150) {
  icuTrigger = true;
}

if (admissionReasons.length >= 4) {
  icuTrigger = true;
}

// ICU escalation
if (icuTrigger) {
  severity = "Critical";
  admissionPlan = "ICU";
  flags.push("ICU Level Care Required");
}
else if (admissionReasons.length >= 2) {
  severity = "High";
  admissionPlan = "Admit";
}
else {
  severity = "Low";
  admissionPlan = "Outpatient";
}
if (icuTrigger && facility && !facility.capabilities.hasICU) {
  visit.referral.required = true;
  visit.referral.patientInformed = false;
  visit.autoReferralReason = "ICU facility unavailable at this center";
}
 /* =========================================
   AI DRAFT CONTENT
========================================== */

let provisionalDiagnosis;
let treatmentPlan;
let referralSuggestion;
let followUpAdvice;

if (severity === "Critical") {
  provisionalDiagnosis = "Septic shock / severe systemic infection";
  treatmentPlan = "Immediate ICU admission. Start IV broad-spectrum antibiotics, aggressive IV fluids, vasopressor support if required, continuous monitoring.";
  referralSuggestion = "Urgent transfer to higher center if ICU facilities unavailable.";
  followUpAdvice = "Continuous monitoring in ICU setting.";
}
else if (severity === "High") {
  provisionalDiagnosis = "Severe infection – rule out sepsis";
  treatmentPlan = "Admit. Start IV antibiotics, IV fluids, close monitoring.";
  referralSuggestion = "Refer if deterioration or lack of improvement.";
  followUpAdvice = "Frequent reassessment of vitals and labs.";
}
else {
  provisionalDiagnosis = "Infective process – clinical correlation required";
  treatmentPlan = "Empirical antibiotics, hydration, outpatient monitoring.";
  referralSuggestion = "No immediate referral required.";
  followUpAdvice = "Review in 24–48 hours.";
}

const draft = {
  provisionalDiagnosis,
  treatmentPlan,
  referralSuggestion,
  followUpAdvice,
  redFlagAdvice:
    "Return immediately if breathlessness, confusion, low urine output, or worsening symptoms."
};
  /* =========================================
     ATTACH CALCULATED VALUES
  ========================================== */

  visit.ruleFlags = flags;
  visit.severityLevel = severity;
  visit.admissionPlan = admissionPlan;
  visit.admissionJustification = admissionReasons;
  visit.qsofaScore = qsofa;
  visit.criticalCare = icuTrigger;
  visit.requiresHigherCenter = icuTrigger && facility && !facility.capabilities.hasICU;
  return draft;
}

module.exports = { generateAIDraft };