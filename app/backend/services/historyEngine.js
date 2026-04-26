function generateHistoryTemplate(chiefComplaint) {
  const complaintStr = chiefComplaint ? chiefComplaint.toLowerCase() : "";

  // 1. Base HPI Structure
  const coreQuestions = [
    "Onset",
    "Duration",
    "Progression",
    "Severity",
    "Aggravating factors",
    "Relieving factors"
  ];
  
  const associatedSymptoms = [];
  const redFlags = [];
  const optionalQuestions = ["Past similar episodes", "Recent travel", "Current medications"];
  
  const mandatoryBackground = [
    "Past medical history",
    "Past surgical history",
    "Drug allergy",
    "Current medications",
    "Habits"
  ];

  // 2. Complaint-based additions
  if (complaintStr.includes("chest") || complaintStr.includes("pain") || complaintStr.includes("angina")) {
    coreQuestions.push("Radiation", "Nature of pain");
    associatedSymptoms.push("Sweating", "Breathlessness");
    redFlags.push("Syncope", "Hypotension");
  } 
  
  if (complaintStr.includes("fever") || complaintStr.includes("infection")) {
    associatedSymptoms.push("Chills", "Cough", "Urinary symptoms");
    redFlags.push("Altered sensorium", "Hypotension");
  } 
  
  if (complaintStr.includes("breath") || complaintStr.includes("shortness")) {
    coreQuestions.push("Orthopnea", "Paroxysmal nocturnal dyspnea (PND)");
    associatedSymptoms.push("Wheeze", "Edema");
    redFlags.push("Low SpO2");
  } 
  
  if (complaintStr.includes("syncope") || complaintStr.includes("fainting") || complaintStr.includes("collapse")) {
    coreQuestions.push("Prodrome", "Triggers", "Duration of unconsciousness", "Recovery time");
    associatedSymptoms.push("Chest pain", "Palpitations", "Shortness of breath");
    redFlags.push("Sudden onset without warning", "Chest pain prior to event", "Exertional syncope", "Family history of sudden death");
  }

  // Deduplicate array values in case of symptom overlap (e.g. fever + breathlessness)
  return {
    coreQuestions: [...new Set(coreQuestions)],
    associatedSymptoms: [...new Set(associatedSymptoms)],
    redFlags: [...new Set(redFlags)],
    optionalQuestions,
    mandatoryBackground
  };
}

module.exports = { generateHistoryTemplate };