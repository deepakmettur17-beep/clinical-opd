const express = require("express");
const router = express.Router();
const { generateAISuggestions } = require("../services/aiReasoningEngine");


// ========================================
// TEST ROUTE
// ========================================
router.get("/test", (req, res) => {
  res.json({ message: "AI route working properly ✅" });
});


// ========================================
// AI SUGGESTION ROUTE
// ========================================
router.post("/suggest", async (req, res) => {
  try {
    const { complaint, vitals = {}, labs = {} } = req.body;

    if (!complaint) {
      return res.status(400).json({
        error: "Complaint is required"
      });
    }

    let practicalFlags = [];

    // ===============================
    // PRACTICAL DECISION THRESHOLDS
    // ===============================

    // 1️⃣ Severe bacterial marker
    if (labs.neutrophils > 80 || labs.crp > 50) {
      practicalFlags.push(
        "High bacterial probability → Continue antibiotics"
      );
    }

    // 2️⃣ Liver injury threshold
    if (
      (labs.ast && labs.ast > 5 * (labs.ast_normal || 40)) ||
      (labs.alt && labs.alt > 5 * (labs.alt_normal || 40))
    ) {
      practicalFlags.push(
        "AST/ALT >5× normal → Consider admission"
      );
    }

    // 3️⃣ Rising creatinine
    if (labs.creatinine_trend === "rising") {
      practicalFlags.push(
        "Creatinine rising → IV hydration ± avoid oral acyclovir → consider IV switch"
      );
    }

    // ===============================
    // AI REASONING ENGINE
    // ===============================
    const aiSuggestions = await generateAISuggestions({
      complaint,
      vitals,
      labs
    });

    res.json({
      complaint,
      practicalFlags,
      aiSuggestions
    });

  } catch (error) {
    console.error("AI Suggestion Error:", error);
    res.status(500).json({
      error: "AI processing failed"
    });
  }
});

module.exports = router;

