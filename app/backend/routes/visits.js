const express = require("express");
const router = express.Router();
const Visit = require("../models/Visit");

// =======================
// CREATE VISIT
// =======================
router.post("/", async (req, res) => {
  try {
    const visit = new Visit(req.body);
    const savedVisit = await visit.save();
    res.status(201).json(savedVisit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =======================
// GET ALL VISITS
// =======================
router.get("/", async (req, res) => {
  try {
    const visits = await Visit.find().populate("patientId");
    res.json(visits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// GET VISIT BY ID
// =======================
router.get("/:id", async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id).populate("patientId");
    if (!visit) {
      return res.status(404).json({ message: "Visit not found" });
    }
    res.json(visit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// UPDATE VISIT
// =======================
router.put("/:id", async (req, res) => {
  try {
    const updatedVisit = await Visit.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedVisit) {
      return res.status(404).json({ message: "Visit not found" });
    }
    res.json(updatedVisit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =======================
// DELETE VISIT
// =======================
router.delete("/:id", async (req, res) => {
  try {
    const deletedVisit = await Visit.findByIdAndDelete(req.params.id);
    if (!deletedVisit) {
      return res.status(404).json({ message: "Visit not found" });
    }
    res.json({ message: "Visit deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
