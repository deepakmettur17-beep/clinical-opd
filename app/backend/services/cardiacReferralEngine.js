function generateSTEMIReferral(visit) {
    return `
  EMERGENCY CARDIAC REFERRAL â€“ PRIMARY PCI
  
  Patient: ${visit.patientId?.name || ""} (${visit.patientId?.age}/${visit.patientId?.sex})
  
  Diagnosis:
  Acute ${visit.cardiacEmergency.stemiType || ""} STEMI
  
  ECG Findings:
  ${visit.cardiacEmergency.ecgFindings || ""}
  
  Time-critical reperfusion required.
  Kindly take up for IMMEDIATE CORONARY ANGIOGRAPHY AND PRIMARY PCI.
  
  Referred at: ${new Date().toLocaleString()}
  `;
  }
  
  module.exports = { generateSTEMIReferral };