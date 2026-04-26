function evaluateFacilityEscalation(visit, facility) {

  if (!facility || !facility.capabilities) return visit;

  const caps = facility.capabilities;

  visit.requiresHigherCenter = false;
  visit.autoReferralReason = "";

  // ICU escalation
  if (visit.admissionPlan === "ICU" && !caps.hasICU) {
    visit.requiresHigherCenter = true;
    visit.autoReferralReason = "ICU facility unavailable at this center.";
  }

  // Dialysis escalation
  if (visit.labs?.creatinine > 4 && !caps.hasDialysis) {
    visit.requiresHigherCenter = true;
    visit.autoReferralReason += " Dialysis facility unavailable.";
  }

  if (visit.requiresHigherCenter) {
    visit.referral.required = true;
  }

  return visit;
}

module.exports = { evaluateFacilityEscalation };


