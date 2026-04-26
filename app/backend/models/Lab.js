const mongoose = require("mongoose");

const LabSchema = new mongoose.Schema({
  visit: { type: mongoose.Schema.Types.ObjectId, ref: "Visit", required: true },
  labName: String,
  value: Number,
  unit: String,
  referenceRange: String,
  trend: { type: String, enum: ["up","down","stable"] },
  time: Date
}, { timestamps: true });

module.exports = mongoose.model("Lab", LabSchema);



