const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const AiOutput = require("../models/AiOutput");

const prompts = {
  DDx: fs.readFileSync(path.join(__dirname,"../ai/prompts/ddx.prompt.txt"),"utf8"),
  Treatment: fs.readFileSync(path.join(__dirname,"../ai/prompts/treatment.prompt.txt"),"utf8"),
  Investigations: fs.readFileSync(path.join(__dirname,"../ai/prompts/investigations.prompt.txt"),"utf8"),
  Advice: fs.readFileSync(path.join(__dirname,"../ai/prompts/advice.prompt.txt"),"utf8")
};

// pseudo-call to your LLM client
async function runLLM(prompt, context){ /* integrate provider */ }

router.post("/run", async (req,res)=>{
  const { visitId, context } = req.body;
  const results = {};
  for (const k of Object.keys(prompts)){
    const out = await runLLM(prompts[k], context);
    await AiOutput.create({ visit: visitId, block: k, content: out });
    results[k] = out;
  }
  res.json(results);
});

module.exports = router;
