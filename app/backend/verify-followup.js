const mongoose = require("mongoose");
const Patient = require("./models/Patient");
const Visit = require("./models/Visit");
const { analyzeTrends, getSuggestions } = require("./services/followUpEngine");
require("dotenv").config();

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  // 1. Create Test Patient
  const patient = await Patient.create({
    firstName: "Chronic",
    lastName: "Test",
    age: 65,
    gender: "Male"
  });

  console.log("Created Patient:", patient._id);

  // 2. Create 3 Visits with Worsening HbA1c and BP
  const v1 = await Visit.create({
    patientId: patient._id,
    vitals: { bp: "130/80" },
    labs: { hba1c: 7.0 },
    finalized: true,
    finalizedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
  });

  const v2 = await Visit.create({
    patientId: patient._id,
    vitals: { bp: "140/85" },
    labs: { hba1c: 7.8 },
    finalized: true,
    finalizedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
  });

  const v3 = await Visit.create({
    patientId: patient._id,
    vitals: { bp: "155/90" },
    labs: { hba1c: 8.5 },
    finalized: true,
    finalizedAt: new Date()
  });

  console.log("Created 3 mock visits");

  // 3. Analyze Trends
  const trends = await analyzeTrends(patient._id);
  console.log("Trend Summary:", JSON.stringify(trends.summary, null, 2));

  // 4. Get Suggestions
  const suggestions = getSuggestions(trends, []);
  console.log("Suggestions:", JSON.stringify(suggestions, null, 2));

  // 5. Check logic
  if (trends.summary.hba1cStatus.includes("Worsening") && trends.summary.bpStatus.includes("Worsening")) {
    console.log("✅ TREND ANALYSIS SUCCESSFUL");
  } else {
    console.log("❌ TREND ANALYSIS FAILED");
  }

  // Cleanup
  await Visit.deleteMany({ patientId: patient._id });
  await Patient.findByIdAndDelete(patient._id);
  await mongoose.disconnect();
}

verify().catch(console.error);
