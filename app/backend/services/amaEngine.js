function generateAMADocumentation(visit) {
    return `
  The patient was advised referral to ${visit.referral.specialty} 
  due to: ${visit.referral.reason}.
  
  The patient was informed about potential risks including:
  - Disease progression
  - Clinical deterioration
  - Emergency complications
  
  Despite explanation, the patient declined referral.
  
  This decision was documented in presence of the treating doctor.
  
  Time: ${new Date().toLocaleString()}
  `;
  }
  
  module.exports = generateAMADocumentation;


