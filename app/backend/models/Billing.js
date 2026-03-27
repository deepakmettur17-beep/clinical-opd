const mongoose = require("mongoose");

const billingSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
  visitId: { type: mongoose.Schema.Types.ObjectId, ref: "Visit" },
  amount: Number,
  paymentMethod: String,
  status: { type: String, default: "pending" }
}, { timestamps: true });

module.exports = mongoose.model("Billing", billingSchema);
