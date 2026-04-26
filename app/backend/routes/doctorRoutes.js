const express = require("express");
const router = express.Router();
const Doctor = require("../models/Doctor");

router.post("/", async (req, res) => {
  try {
    const doctor = new Doctor(req.body);
    await doctor.save();
    res.json(doctor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Doctor creation failed" });
  }
});

module.exports = router;

