const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    // Basic Identity
    firstName: { type: String, required: true },
    lastName: { type: String },
    age: { type: Number, required: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },

    phone: { type: String },
    address: { type: String },

    // Medical Safety
    allergies: { type: String, default: "None" },
    chronicConditions: { type: String },
    currentMedications: { type: String },

    // Risk Flags (longitudinal)
    highRiskPatient: { type: Boolean, default: false },

    complianceMeta: {
      lastVisitDate: { type: Date },
      missedVisits: { type: Number, default: 0 },
      adherenceNotes: { type: String, default: "" },
      lastHbA1c: { type: Number },
      lastSBP: { type: Number }
    },

    // Audit
    createdBy: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);

