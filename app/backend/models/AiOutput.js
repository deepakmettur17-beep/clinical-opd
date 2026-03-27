const mongoose = require("mongoose");

const AiOutputSchema = new mongoose.Schema({
  visit: { type: mongoose.Schema.Types.ObjectId, ref: "Visit", required: true },
  block: { type: String, enum: ["DDx","Treatment","Investigations","Advice","Chatbot"] },
  content: String,
  doctorEdited: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("AiOutput", AiOutputSchema);
