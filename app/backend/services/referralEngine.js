function generateAMADocumentation(visit) {

    const reasons = visit.admissionJustification || [];
    const complaint = visit.chiefComplaint || "current illness";
  
    const riskSummary = reasons.length > 0
      ? reasons.join(", ")
      : "clinical instability";
  
    return `
  PATIENT REFUSAL / AMA DOCUMENTATION
  
  The patient was advised admission/referral due to:
  ${riskSummary}.
  
  The risks including possible deterioration, organ failure, and death were explained in simple language.
  
  Despite explanation, the patient declined recommended referral/admission.
  
  Patient understands risks and chooses discharge against medical advice.
  
  Date: ${new Date().toISOString()}
  Chief Complaint: ${complaint}
  `;
  }
  
  function processReferralDecision(visit) {
  
    if (visit.referral?.required && visit.referral?.accepted === false) {
  
      visit.referral.ama = true;
      visit.referral.amaDocumentation = generateAMADocumentation(visit);
  
    }
  
    return visit;
  }
  
  module.exports = {
    generateAMADocumentation,
    processReferralDecision
  };