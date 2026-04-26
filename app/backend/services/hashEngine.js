const crypto = require("crypto");

function generateVisitHash(visit) {
  const dataString = JSON.stringify({
    patientId: visit.patientId,
    chiefComplaint: visit.chiefComplaint,
    vitals: visit.vitals,
    labs: visit.labs,
    finalPrescription: visit.finalPrescription,
    admissionPlan: visit.admissionPlan,
    referral: visit.referral
  });

  return crypto.createHash("sha256").update(dataString).digest("hex");
}

module.exports = { generateVisitHash };