function generateTransferLetter(visit, patient, facility) {

    console.log("ENGINE RECEIVED PATIENT:", patient);

    const patientName = patient && patient.name ? patient.name : "N/A";
    const patientAge = patient && patient.age ? patient.age : "N/A";
    const patientSex = patient && patient.sex ? patient.sex : "N/A";
    const facilityName = facility && facility.name ? facility.name : "Unknown Facility";
    
  
    return `
      =====================================
                PATIENT TRANSFER LETTER
      =====================================
  
      Date: ${new Date().toISOString()}
  
      Patient Name: ${patient.name}
      Age / Sex: ${patient.age} / ${patient.sex}
  
      -------------------------------------
      Chief Complaint:
      -------------------------------------
      ${visit.chiefComplaint || "N/A"}
  
      -------------------------------------
      Clinical Summary:
      -------------------------------------
  
      Severity Level: ${visit.severityLevel || "N/A"}
      Admission Plan: ${visit.admissionPlan || "N/A"}
  
      Vitals:
      BP: ${visit.vitals?.bp || "N/A"}
      Pulse: ${visit.vitals?.pulse || "N/A"}
      SpO2: ${visit.vitals?.spo2 || "N/A"}
  
      -------------------------------------
      Reason for Transfer:
      -------------------------------------
  
      ${visit.autoReferralReason || "Clinical escalation required."}
  
      Referring Facility: ${facilityName}
  
      Doctor Signature:
      __________________________
  
      =====================================
    `;
  }
  module.exports = { generateTransferLetter };