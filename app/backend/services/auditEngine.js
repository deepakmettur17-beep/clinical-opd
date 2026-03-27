function logRiskAudit(visit) {

    const auditEntry = {
      severityLevel: visit.severityLevel,
      ruleFlags: visit.ruleFlags || [],
      qsofaScore: visit.qsofaScore || 0,
      facilityMismatch: visit.requiresHigherCenter || false,
      admissionPlan: visit.admissionPlan,
      referralRequired: visit.referral?.required || false,
      doctorOverride: false,
      notes: visit.autoReferralReason || ""
    };
  
    visit.riskAuditTrail.push(auditEntry);
  
    return visit;
  }
  
  module.exports = { logRiskAudit };