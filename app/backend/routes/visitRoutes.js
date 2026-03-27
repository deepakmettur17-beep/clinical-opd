const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const crypto = require("crypto");

const Visit = require("../models/Visit");
const Facility = require("../models/Facility");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");

const { generateAIDraft } = require("../services/aiEngine");
const { evaluateFacilityEscalation } = require("../services/capabilityEngine");
const { generateTransferLetter } = require("../services/transferEngine");
const { generateSTEMIReferral } = require("../services/cardiacReferralEngine");
const { evaluateCardiacIntelligence } = require("../services/cardiacEngine");
const { calculateGraceScore } = require("../services/graceEngine");
const { applyKillipMortality } = require("../services/killipEngine");
const { calculateDTB } = require("../services/dtbEngine");
const { calculateTransferTime } = require("../services/transferTimeEngine");

/* =====================================================
   CREATE VISIT
===================================================== */
router.post("/", async (req, res) => {
  try {
    const visit = new Visit(req.body);
    // Cardiac Intelligence Engine
evaluateCardiacIntelligence(visit);

    const facility = await Facility.findById(req.body.facilityId);
    const patient = await Patient.findById(req.body.patientId);

   // Generate AI draft with facility awareness
const aiDraft = await generateAIDraft(visit, facility);
visit.aiDraft = aiDraft;

/* ==========================================
   STEMI CARDIAC OVERRIDE (ADD HERE)
========================================== */
if (visit.cardiacEmergency?.isSTEMI) {
  visit.aiDraft = {
    provisionalDiagnosis:
      "Acute STEMI with cardiogenic shock",
    treatmentPlan:
      "Immediate cath lab activation. Primary PCI indicated. Hemodynamic support required.",
    referralSuggestion:
      "Urgent transfer to PCI-capable center if cath lab unavailable.",
    followUpAdvice:
      "Continuous cardiac monitoring. Post-PCI ICU care.",
    redFlagAdvice:
      "Immediate deterioration risk. Maintain hemodynamic monitoring."
  };

  visit.cardiacEmergency.pciRecommended = true;
}
if (visit.cardiacEmergency?.isSTEMI) {

  visit.doorTime = new Date();

}
if (visit.cardiacEmergency?.isSTEMI) {

  const { score, category } = calculateGraceScore(visit, patient);

  visit.graceScore = score;
  visit.graceRiskCategory = category;

}

applyKillipMortality(visit);
calculateDTB(visit);
calculateTransferTime(visit);

if (visit.cardiacEmergency?.isSTEMI) {

  const { score, mortality } = calculateGraceScore(visit, patient);

  visit.graceScore = score;
  visit.graceEstimatedMortalityPercent = mortality;

}

    // Escalation
    evaluateFacilityEscalation(visit, facility);

    // STEMI Logic
    if (visit.cardiacEmergency?.isSTEMI) {
      visit.severityLevel = "Critical";
      visit.criticalCare = true;
      visit.admissionPlan = "Immediate PCI";
      visit.ruleFlags = visit.ruleFlags || [];
      visit.ruleFlags.push("STEMI Alert – Immediate PCI Required");
      visit.transferLetter = generateSTEMIReferral(visit);
    }

    // Higher center referral
    if (visit.requiresHigherCenter || visit.referral?.required) {
      console.log("TRANSFER PATIENT OBJECT:", patient);
      visit.transferLetter = generateTransferLetter(
        visit,
        patient,
        facility
      );
    }

    router.post("/:id/balloon-inflated", async (req, res) => {
      try {
    
        const visit = await Visit.findById(req.params.id);
        if (!visit) {
          return res.status(404).json({ error: "Visit not found" });
        }
    
        visit.balloonTime = new Date();
    
        const diffMs = visit.balloonTime - visit.doorTime;
        const diffMinutes = Math.floor(diffMs / 60000);
    
        visit.doorToBalloonMinutes = diffMinutes;
    
        if (diffMinutes <= 90) {
          visit.dtbPerformanceFlag = "Within guideline (≤90 min)";
        } else {
          visit.dtbPerformanceFlag = "Delayed (>90 min)";
        }
    
        await visit.save();
    
        res.json({
          message: "Balloon time recorded",
          doorToBalloonMinutes: diffMinutes,
          performance: visit.dtbPerformanceFlag
        });
    
      } catch (err) {
        res.status(500).json({ error: "DTB calculation failed" });
      }
    });

    // Build Final Prescription
    visit.finalPrescription = {
      provisionalDiagnosis: visit.aiDraft?.provisionalDiagnosis || "",
      treatmentPlan: visit.aiDraft?.treatmentPlan || "",
      referralNote: visit.aiDraft?.referralSuggestion || "",
      followUpAdvice: visit.aiDraft?.followUpAdvice || "",
      redFlagAdvice: visit.aiDraft?.redFlagAdvice || "",
      admissionPlan: visit.admissionPlan,
      admissionJustification: visit.admissionJustification || [],
      doctorEdited: false
    };

    await visit.save();
    res.status(201).json(visit);

  } catch (err) {
    console.error("VISIT CREATE ERROR:", err);
    res.status(500).json({
      error: "Visit creation failed",
      message: err.message
    });
  }
});

/* =====================================================
   DOCTOR OVERRIDE
===================================================== */
router.post("/:id/doctor-override", async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });

    const { admissionPlan, severityLevel, referralRequired, notes } = req.body;

    const auditEntry = {
      severityLevel: severityLevel || visit.severityLevel,
      admissionPlan: admissionPlan || visit.admissionPlan,
      referralRequired: referralRequired ?? visit.referral?.required,
      doctorOverride: true,
      notes: notes || "",
      timestamp: new Date()
    };

    visit.severityLevel = severityLevel || visit.severityLevel;
    visit.admissionPlan = admissionPlan || visit.admissionPlan;

    if (typeof referralRequired === "boolean") {
      visit.referral = visit.referral || {};
      visit.referral.required = referralRequired;
    }

    visit.riskAuditTrail = visit.riskAuditTrail || [];
    visit.riskAuditTrail.push(auditEntry);

    await visit.save();

    res.json({
      message: "Override successful",
      visit
    });

  } catch (err) {
    console.error("OVERRIDE ERROR:", err);
    res.status(500).json({
      error: "Override failed",
      message: err.message
    });
  }
});

/* =====================================================
   FINALIZE VISIT (WITH HASH CHAIN)
===================================================== */
router.post("/:id/finalize", async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });

    const doctor = await Doctor.findById(req.body.doctorId);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    // Find previous finalized visit
    const lastVisit = await Visit.findOne({ finalized: true })
      .sort({ finalizedAt: -1 });

    visit.previousHash = lastVisit ? lastVisit.recordHash : "GENESIS";

    const payload = visit.previousHash + JSON.stringify({
      patientId: visit.patientId,
      chiefComplaint: visit.chiefComplaint,
      finalPrescription: visit.finalPrescription,
      admissionPlan: visit.admissionPlan,
      admissionJustification: visit.admissionJustification,
      severityLevel: visit.severityLevel
    });

    visit.recordHash = crypto
      .createHash("sha256")
      .update(payload)
      .digest("hex");

    visit.finalized = true;
    visit.finalizedAt = new Date();
    visit.doctorId = doctor._id;

    await visit.save();

    res.json({
      message: "Visit finalized successfully",
      recordHash: visit.recordHash
    });

  } catch (err) {
    console.error("FINALIZE ERROR:", err);
    res.status(500).json({
      error: "Finalize failed",
      message: err.message
    });
  }
});

/* =====================================================
   VERIFY RECORD
===================================================== */
router.post("/verify", async (req, res) => {
  try {
    const { visitId, hash } = req.body;

    if (!mongoose.Types.ObjectId.isValid(visitId))
      return res.status(400).json({ error: "Invalid visit ID" });

    const visit = await Visit.findById(visitId);
    if (!visit) return res.status(404).json({ error: "Visit not found" });

    const payload = visit.previousHash + JSON.stringify({
      patientId: visit.patientId,
      chiefComplaint: visit.chiefComplaint,
      finalPrescription: visit.finalPrescription,
      admissionPlan: visit.admissionPlan,
      admissionJustification: visit.admissionJustification,
      severityLevel: visit.severityLevel
    });

    const recalculatedHash = crypto
      .createHash("sha256")
      .update(payload)
      .digest("hex");

    res.json({
      valid: recalculatedHash === hash,
      message:
        recalculatedHash === hash
          ? "Record is authentic and unchanged"
          : "Record has been altered"
    });

  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(500).json({
      error: "Verification failed",
      message: err.message
    });
  }
});

module.exports = router;