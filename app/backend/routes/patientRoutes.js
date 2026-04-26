const express = require("express");
const router = express.Router();
const patientController = require("../controllers/patientController");
const { requireAuth } = require("../middleware/authMiddleware");

// Note: In server.js we passed state to requireAuth. 
// For now, I'll assume we handle the state injection in a cleaner way or pass it via middleware factory.

router.get("/", patientController.getPatients);
router.get("/:id", patientController.getPatientById);
router.post("/", patientController.createPatient);
router.put("/:id", patientController.updatePatient);

module.exports = router;
