const express = require("express");
const router = express.Router();
const clinicalController = require("../controllers/clinicalController");
const validate = require("../middleware/validate");
const { clinicalEvaluateSchema } = require("../middleware/validations/clinicalValidation");
const { clinicalLimiter, authorize } = require("../middleware/securityMiddleware");

router.post("/clinical", clinicalLimiter, authorize('CONSULTANT', 'DOCTOR'), validate(clinicalEvaluateSchema), clinicalController.evaluateClinicalCase);
router.post("/hospital", clinicalLimiter, authorize('CONSULTANT', 'DOCTOR'), clinicalController.evaluateHospitalOS);
router.get("/clinical/followup/:patientId", clinicalController.getFollowUpAnalysis);

module.exports = router;


