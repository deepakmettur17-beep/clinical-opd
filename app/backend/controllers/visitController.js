const Visit = require("../models/Visit");

const getVisits = async (req, res) => {
  try {
    const visits = await Visit.find().populate("patientId doctorId");
    res.json(visits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createVisit = async (req, res) => {
  try {
    const visit = await Visit.create(req.body);
    res.status(201).json(visit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getVisits,
  createVisit
};


