const express = require("express");
const router = express.Router();
const visitController = require("../controllers/visitController");

router.post("/", visitController.createVisit);
router.post("/:id/finalize", visitController.finalizeVisit);
router.post("/verify", visitController.verifyVisit);

module.exports = router;
