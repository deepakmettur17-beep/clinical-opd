const mongoose = require("mongoose");

const VisitSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true
    },

    facilityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Facility"
    },

    chiefComplaint: {
      type: String,
      default: ""
    },

    history: {
      type: Array,
      default: []
    },

    vitals: {
      bp: String,
      pulse: Number,
      temperature: Number,
      spo2: Number
    },

    labs: {
      neutrophils: Number,
      crp: Number,
      creatinine: Number,
      ast: Number,
      alt: Number,
      hba1c: Number,
      fbs: Number,
      ppbs: Number
    },

    chronicDiseaseMarkers: {
      painScore: { type: Number, min: 0, max: 10 },
      mobility: { type: String }, // Good / Restricted / Bed-bound
      peakFlow: { type: Number }
    },

    structuredMeds: [
      {
        name: String,
        dose: String,
        frequency: String,
        action: { type: String, enum: ["Continue", "Increase", "Reduce", "Stop", "Switch", "New"], default: "Continue" },
        duration: String
      }
    ],

    ruleFlags: {
      type: [String],
      default: []
    },

    severityLevel: {
      type: String,
      enum: ["Low", "Moderate", "High", "Critical"],
      default: "Low"
    },

    qsofaScore: {
      type: Number,
      default: 0
    },

    criticalCare: {
      type: Boolean,
      default: false
    },

    admissionPlan: {
      type: String,
      enum: [
        "Outpatient",
        "Ward",
        "ICU",
        "Immediate PCI",
        "Cath Lab",
        "Emergency Transfer"
      ],
      default: "Outpatient"
    },
    admissionJustification: {
      type: [String],
      default: []
    },

    referral: {
      required: { type: Boolean, default: false },
      patientInformed: { type: Boolean, default: false },
      accepted: { type: Boolean, default: true },
      ama: { type: Boolean, default: false },
      amaDocumentation: { type: String, default: "" }
    },

    requiresHigherCenter: {
      type: Boolean,
      default: false
    },

    autoReferralReason: {
      type: String,
      default: ""
    },

    aiDraft: {
      provisionalDiagnosis: String,
      differentials: [String],
      treatmentPlan: String,
      referralSuggestion: String,
      followUpAdvice: String,
      redFlagAdvice: String
    },
    cardiacEmergency: {
      isSTEMI: { type: Boolean, default: false },
      stemiType: { type: String }, // Anterior / Inferior / Lateral / Posterior
      ecgFindings: { type: String },
      troponinPositive: { type: Boolean },
      killipClass: { type: Number },
      suspectedArtery: { type: String }, // LAD / RCA / LCX
      priorStentHistory: { type: Boolean, default: false },
      doorTime: { type: Date },
      referralTime: { type: Date },
      pciRecommended: { type: Boolean, default: false },
      transferInitiated: { type: Boolean, default: false },
    },

    // ================= CARDIAC INTELLIGENCE =================
ecg: {
  stElevationLeads: [String],
  reciprocalChanges: { type: Boolean, default: false },
  stDepressionLeads: [String],
  troponinPositive: { type: Boolean, default: false }
},

killipClass: { type: Number, default: 0 },
mortalityRiskEstimate: { type: String, default: "" },

cardiacTimestamps: {
  erArrivalTime: Date,
  ecgTime: Date,
  stemiActivationTime: Date,
  cathLabArrivalTime: Date,
  balloonInflationTime: Date
},

doorToBalloonMinutes: { type: Number, default: 0 },
// ========================================================
    finalPrescription: {
      provisionalDiagnosis: String,
      treatmentPlan: String,
      referralNote: String,
      followUpAdvice: String,
      redFlagAdvice: String,
      admissionPlan: String,
      admissionJustification: [String],
      doctorEdited: { type: Boolean, default: false }
    },

    transferLetter: {
      type: String,
      default: ""
    },

    riskAuditTrail: [
      {
        severityLevel: String,
        ruleFlags: [String],
        qsofaScore: Number,
        facilityMismatch: Boolean,
        admissionPlan: String,
        referralRequired: Boolean,
        doctorOverride: Boolean,
        notes: String,
        timestamp: { type: Date, default: Date.now }
      }
    ],

    version: {
      type: Number,
      default: 1
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor"
    },
    finalized: {
      type: Boolean,
      default: false
    },

    finalizedAt: {
      type: Date
    },
    previousHash: { type: String, default: "GENESIS" },
    recordHash: {
      type: String,
      default: ""
    },

      graceScore: { type: Number, default: 0 },
      graceRiskCategory: { type: String, default: "" },
      killipMortalityPercent: { type: String, default: "" },
      
      
      graceEstimatedMortalityPercent: { type: String, default: "" },

      pciDelayAlert: { type: Boolean, default: false },
      pciDelayLevel: { type: String, default: "" },
      pciAlertGeneratedAt: { type: Date },  
   doorTime: { type: Date },
balloonTime: { type: Date },
doorToBalloonMinutes: { type: Number, default: 0 },
dtbPerformanceFlag: { type: String, default: "" },
transferDecisionTime: { type: Date },
transferOutTime: { type: Date },
doorToTransferMinutes: { type: Number, default: 0 }


    
  },


  { timestamps: true }
);
/* =====================================================
   DOOR-TO-BALLOON ENGINE
===================================================== */

VisitSchema.methods.calculateDoorToBalloon = function () {

  // Only apply for STEMI
  if (!this.cardiacEmergency?.isSTEMI) {
    this.doorToBalloonMinutes = 0;
    this.dtbPerformanceFlag = "";
    return;
  }

  // Must have both timestamps
  if (!this.doorTime || !this.balloonTime) {
    this.doorToBalloonMinutes = 0;
    this.dtbPerformanceFlag = "";
    return;
  }

  const door = new Date(this.doorTime);
  const balloon = new Date(this.balloonTime);

  // Invalid date safety
  if (isNaN(door.getTime()) || isNaN(balloon.getTime())) {
    this.doorToBalloonMinutes = 0;
    this.dtbPerformanceFlag = "";
    return;
  }

  // Calculate correctly: Balloon - Door
  const diffMinutes = Math.round((balloon - door) / 60000);

  // Prevent negative DTB
  if (diffMinutes < 0) {
    this.doorToBalloonMinutes = 0;
    this.dtbPerformanceFlag = "INVALID_TIME_SEQUENCE";
    return;
  }

  this.doorToBalloonMinutes = diffMinutes;

  // Performance Classification (ESC/ACC Standard)
  if (diffMinutes <= 90) {
    this.dtbPerformanceFlag = "ON_TIME";
  } else if (diffMinutes <= 120) {
    this.dtbPerformanceFlag = "MODERATE_DELAY";
  } else {
    this.dtbPerformanceFlag = "SEVERE_DELAY";
  }
};


module.exports = mongoose.model("Visit", VisitSchema);
VisitSchema.pre("save", function () {
  this.calculateDoorToBalloon();
});