const express = require("express");
const router = express.Router();
const Facility = require("../models/Facility");

// Create facility
router.post("/", async (req, res) => {
  try {
    const facility = new Facility(req.body);
    await facility.save();
    res.status(201).json(facility);
  } catch (err) {
    res.status(500).json({ error: "Facility creation failed", message: err.message });
  }
});

// Get all facilities
router.get("/", async (req, res) => {
  try {
    const facilities = await Facility.find();
    res.json(facilities);
  } catch (err) {
    res.status(500).json({ error: "Fetch failed", message: err.message });
  }
});

module.exports = router;