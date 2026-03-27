const router = require("express").Router();
const Examination = require("../models/Examination");

router.post("/", async (req,res)=>{
  const e = await Examination.create(req.body);
  res.json(e);
});

router.get("/:visitId", async (req,res)=>{
  const e = await Examination.findOne({ visit: req.params.visitId });
  res.json(e);
});

module.exports = router;
