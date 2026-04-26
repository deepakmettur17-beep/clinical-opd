const router = require("express").Router();
const Lab = require("../models/Lab");

router.post("/", async (req,res)=>{
  const l = await Lab.create(req.body);
  res.json(l);
});

router.get("/:visitId", async (req,res)=>{
  const l = await Lab.find({ visit: req.params.visitId }).sort({time:1});
  res.json(l);
});

module.exports = router;


