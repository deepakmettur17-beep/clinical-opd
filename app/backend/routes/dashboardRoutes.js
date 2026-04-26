const express = require("express");
const router = express.Router();
const Visit = require("../models/Visit");

router.get("/cardiology", async (req, res) => {
  try {

    const totalSTEMI = await Visit.countDocuments({
      "cardiacEmergency.isSTEMI": true
    });

    const delayedPCI = await Visit.countDocuments({
      "cardiacEmergency.isSTEMI": true,
      doorToBalloonMinutes: { $gt: 90 }
    });

    const killipIV = await Visit.countDocuments({
      killipClass: 4
    });

    const highGraceRisk = await Visit.countDocuments({
      graceScore: { $gte: 150 }
    });

    const transfers = await Visit.countDocuments({
      requiresHigherCenter: true
    });

    const icuAdmissions = await Visit.countDocuments({
      admissionPlan: "ICU"
    });

    const dtbData = await Visit.find({
      "cardiacEmergency.isSTEMI": true,
      doorToBalloonMinutes: { $gt: 0 }
    });

    const onTimePCI = await Visit.countDocuments({
        "cardiacEmergency.isSTEMI": true,
        dtbPerformanceFlag: "On Time (â‰¤90 min)"
      });

      const activeDelays = await Visit.countDocuments({
        pciDelayAlert: true
      });

    let avgDTB = 0;

    if (dtbData.length > 0) {
      const totalMinutes = dtbData.reduce(
        (sum, v) => sum + v.doorToBalloonMinutes,
        0
      );
      avgDTB = Math.round(totalMinutes / dtbData.length);
    }

    res.json({
      totalSTEMI,
      avgDoorToBalloon: avgDTB,
      delayedPCI,
      killipIV,
      highGraceRisk,
      transfers,
      icuAdmissions
    });

  } catch (err) {
    res.status(500).json({ error: "Dashboard failed" });
  }
});

module.exports = router;

