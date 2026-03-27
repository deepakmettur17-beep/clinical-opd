const Visit = require("../models/Visit");

exports.getVisits = async (req, res) => {
  const visits = await Visit.find().populate("patientId");
  res.json(visits);
};

exports.createVisit = async (req, res) => {
  const visit = await Visit.create(req.body);
  res.status(201).json(visit);
};
