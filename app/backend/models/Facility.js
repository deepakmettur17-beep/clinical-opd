const mongoose = require("mongoose");

const facilitySchema = new mongoose.Schema({

  name: String,

  capabilities: {
    hasICU: { type: Boolean, default: false },
    hasVentilator: { type: Boolean, default: false },
    hasDialysis: { type: Boolean, default: false },
    hasCathLab: { type: Boolean, default: false },
    hasBloodBank: { type: Boolean, default: false }
  }

}, { timestamps: true });

module.exports = mongoose.model("Facility", facilitySchema);