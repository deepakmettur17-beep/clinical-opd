const { generateAISuggestions } = require("../services/aiReasoningEngine");
const { catchAsync } = require("../middleware/errorMiddleware");

const getAISuggestions = catchAsync(async (req, res) => {
  const { complaint, vitals = {}, labs = {} } = req.body;

  if (!complaint) {
    return res.status(400).json({
      success: false,
      message: "Complaint is required"
    });
  }

  let practicalFlags = [];

  // Practical Decision Thresholds
  if (labs.neutrophils > 80 || labs.crp > 50) {
    practicalFlags.push("High bacterial probability → Continue antibiotics");
  }

  if (
    (labs.ast && labs.ast > 5 * (labs.ast_normal || 40)) ||
    (labs.alt && labs.alt > 5 * (labs.alt_normal || 40))
  ) {
    practicalFlags.push("AST/ALT >5× normal → Consider admission");
  }

  if (labs.creatinine_trend === "rising") {
    practicalFlags.push("Creatinine rising → IV hydration ± avoid oral acyclovir → consider IV switch");
  }

  const aiSuggestions = await generateAISuggestions({
    complaint,
    vitals,
    labs
  });

  res.json({
    success: true,
    data: {
      complaint,
      practicalFlags,
      aiSuggestions
    }
  });
});

module.exports = {
  getAISuggestions
};
