const mongoose = require("mongoose");
const crypto = require("crypto");
const Visit = require("../models/Visit");
const Facility = require("../models/Facility");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const { catchAsync } = require("../middleware/errorMiddleware");

const { generateAIDraft } = require("../services/aiEngine");
const { evaluateFacilityEscalation } = require("../services/capabilityEngine");
const { generateTransferLetter } = require("../services/transferEngine");
const { generateSTEMIReferral } = require("../services/cardiacReferralEngine");
const { evaluateCardiacIntelligence } = require("../services/cardiacEngine");
const { calculateGraceScore } = require("../services/graceEngine");
const { applyKillipMortality } = require("../services/killipEngine");
const { calculateDTB } = require("../services/dtbEngine");
const { calculateTransferTime } = require("../services/transferTimeEngine");

const createVisit = catchAsync(async (req, res) => {
    const visit = new Visit(req.body);
    
    // Cardiac Intelligence Engine
    evaluateCardiacIntelligence(visit);

    const facility = await Facility.findById(req.body.facilityId);
    const patient = await Patient.findById(req.body.patientId);

    // Generate AI draft with facility awareness
    const aiDraft = await generateAIDraft(visit, facility);
    visit.aiDraft = aiDraft;

    // STEMI Logic
    if (visit.cardiacEmergency?.isSTEMI) {
        visit.aiDraft = {
            provisionalDiagnosis: "Acute STEMI with cardiogenic shock",
            treatmentPlan: "Immediate cath lab activation. Primary PCI indicated. Hemodynamic support required.",
            referralSuggestion: "Urgent transfer to PCI-capable center if cath lab unavailable.",
            followUpAdvice: "Continuous cardiac monitoring. Post-PCI ICU care.",
            redFlagAdvice: "Immediate deterioration risk. Maintain hemodynamic monitoring."
        };
        visit.cardiacEmergency.pciRecommended = true;
        visit.doorTime = new Date();
        
        const { score, mortality } = calculateGraceScore(visit, patient);
        visit.graceScore = score;
        visit.graceEstimatedMortalityPercent = mortality;
        
        visit.severityLevel = "Critical";
        visit.criticalCare = true;
        visit.admissionPlan = "Immediate PCI";
        visit.ruleFlags = visit.ruleFlags || [];
        visit.ruleFlags.push("STEMI Alert – Immediate PCI Required");
        visit.transferLetter = generateSTEMIReferral(visit);
    }

    applyKillipMortality(visit);
    calculateDTB(visit);
    calculateTransferTime(visit);

    // Escalation
    evaluateFacilityEscalation(visit, facility);

    // Higher center referral
    if (visit.requiresHigherCenter || visit.referral?.required) {
        visit.transferLetter = generateTransferLetter(visit, patient, facility);
    }

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
    res.status(201).json({ success: true, data: visit });
});

const finalizeVisit = catchAsync(async (req, res) => {
    const visit = await Visit.findById(req.params.id);
    if (!visit) return res.status(404).json({ success: false, message: "Visit not found" });

    const doctor = await Doctor.findById(req.body.doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const lastVisit = await Visit.findOne({ finalized: true }).sort({ finalizedAt: -1 });
    visit.previousHash = lastVisit ? lastVisit.recordHash : "GENESIS";

    const payload = visit.previousHash + JSON.stringify({
        patientId: visit.patientId,
        chiefComplaint: visit.chiefComplaint,
        finalPrescription: visit.finalPrescription,
        admissionPlan: visit.admissionPlan,
        admissionJustification: visit.admissionJustification,
        severityLevel: visit.severityLevel
    });

    visit.recordHash = crypto.createHash("sha256").update(payload).digest("hex");
    visit.finalized = true;
    visit.finalizedAt = new Date();
    visit.doctorId = doctor._id;

    await visit.save();
    res.json({ success: true, data: { recordHash: visit.recordHash } });
});

const verifyVisit = catchAsync(async (req, res) => {
    const { visitId, hash } = req.body;
    if (!mongoose.Types.ObjectId.isValid(visitId))
        return res.status(400).json({ success: false, message: "Invalid visit ID" });

    const visit = await Visit.findById(visitId);
    if (!visit) return res.status(404).json({ success: false, message: "Visit not found" });

    const payload = visit.previousHash + JSON.stringify({
        patientId: visit.patientId,
        chiefComplaint: visit.chiefComplaint,
        finalPrescription: visit.finalPrescription,
        admissionPlan: visit.admissionPlan,
        admissionJustification: visit.admissionJustification,
        severityLevel: visit.severityLevel
    });

    const recalculatedHash = crypto.createHash("sha256").update(payload).digest("hex");
    res.json({
        success: true,
        data: {
            valid: recalculatedHash === hash,
            message: recalculatedHash === hash ? "Record is authentic" : "Record altered"
        }
    });
});

module.exports = {
    createVisit,
    finalizeVisit,
    verifyVisit
};
