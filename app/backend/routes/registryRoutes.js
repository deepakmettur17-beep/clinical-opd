const express = require("express");
const router = express.Router();
const { Parser } = require("json2csv");

const Visit = require("../models/Visit");
const Patient = require("../models/Patient");
const Facility = require("../models/Facility");

router.get("/stemi-export", async (req, res) => {
  try {

    const visits = await Visit.find({
      "cardiacEmergency.isSTEMI": true
    }).lean();

    const enriched = [];

    for (const visit of visits) {

      const patient = await Patient.findById(visit.patientId).lean();
      const facility = await Facility.findById(visit.facilityId).lean();

      enriched.push({
        visitId: visit._id,
        patientName: patient?.name || "N/A",
        age: patient?.age || "N/A",
        sex: patient?.sex || "N/A",
        killipClass: visit.killipClass || "",
        graceScore: visit.graceScore || "",
        graceMortality: visit.graceEstimatedMortalityPercent || "",
        doorToBalloon: visit.doorToBalloonMinutes || "",
        transferRequired: visit.requiresHigherCenter || false,
        admissionPlan: visit.admissionPlan || "",
        facility: facility?.name || "N/A",
        createdAt: visit.createdAt
       
      });
dtbPerformance: visit.dtbPerformanceFlag || ""
pciDelay: visit.pciDelayLevel || ""
    }

    const parser = new Parser();
    const csv = parser.parse(enriched);

    res.header("Content-Type", "text/csv");
    res.attachment("stemi_registry_export.csv");
    return res.send(csv);

  } catch (err) {
    console.error("REGISTRY EXPORT ERROR:", err);
    res.status(500).json({ error: "Registry export failed" });
  }
});

module.exports = router;