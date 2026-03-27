const express = require("express");
const router = express.Router();
const clinicalController = require("../controllers/clinicalController");

router.post("/clinical", clinicalController.evaluateClinicalCase);
router.post("/hospital", clinicalController.evaluateHospitalOS);
router.get("/clinical/followup/:patientId", clinicalController.getFollowUpAnalysis);

module.exports = router;
