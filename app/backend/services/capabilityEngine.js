function evaluateFacilityEscalation(visit, facility) {

  if (!facility || !facility.capabilities) return;

  const caps = facility.capabilities;

  // STEMI handling
  if (visit.cardiacEmergency?.isSTEMI) {

    if (!caps.hasCathLab) {
      visit.requiresHigherCenter = true;
      visit.autoReferralReason = "No cath lab available at this center.";
      visit.referral.required = true;
      visit.cardiacEmergency.transferInitiated = true;
    } else {
      visit.requiresHigherCenter = false;
      visit.autoReferralReason = "";
      visit.referral.required = false;
    }
  }

  // Cardiogenic shock handling
  if (visit.killipClass === 4) {

    if (!caps.hasICU) {
      visit.requiresHigherCenter = true;
      visit.autoReferralReason = "ICU unavailable for cardiogenic shock.";
      visit.referral.required = true;
    }
  }

}

module.exports = { evaluateFacilityEscalation };