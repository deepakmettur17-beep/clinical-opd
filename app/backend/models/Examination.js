const mongoose = require("mongoose");

const ExaminationSchema = new mongoose.Schema({
  visit: { type: mongoose.Schema.Types.ObjectId, ref: "Visit", required: true },
  generalExam: {
    pallor: Boolean,
    icterus: Boolean,
    edema: Boolean,
    cyanosis: Boolean,
    clubbing: Boolean
  },
  systemicExam: {
    CVS: String,
    RS: String,
    Abdomen: String,
    CNS: String
  },
  focusedFindings: String
}, { timestamps: true });

module.exports = mongoose.model("Examination", ExaminationSchema);



