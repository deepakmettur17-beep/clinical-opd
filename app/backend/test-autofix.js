const { analyzeClaimGaps } = require('./services/ClaimAutoFixEngine');

const mockBillingOutput = {
  caseId: "TEST-AUTO-FIX-001",
  claimScore: 50,
  confidenceScore: 30,
  telemetryStats: {
    density: 1.5,
    continuity: "INTERRUPTED",
    gapCount: 1,
    gaps: [{ durationMins: 130 }]
  },
  billingItems: [
    {
      type: "ICU_STAY",
      strength: "WEAK",
      evidence: { escalationStatus: "N/A", triggerValue: null },
      defense: { indication: "General Clinical Monitoring", response: "Continuous evaluation in progress." }
    },
    {
      type: "VENTILATOR",
      strength: "MODERATE",
      evidence: { escalationStatus: "DELAYED", triggerValue: 82 },
      defense: { indication: "Oxygen drop: 82%", response: "Continuous evaluation in progress." }
    }
  ]
};

console.log("--- STARTING CLAIM AUTO-FIX ENGINE VALIDATION ---");
const result = analyzeClaimGaps(mockBillingOutput);

console.log(`\nCurrent Score: ${result.currentScore}`);
console.log(`Projected Score (After Fixes): ${result.projectedScore}`);
console.log(`Total Fixes Generated: ${result.fixes.length}`);

console.log("\n--- DETECTED GAPS & REMEDIATIONS ---");
result.fixes.forEach((f, i) => {
  console.log(`\n[${i+1}] ISSUE: ${f.issue} (${f.severity})`);
  console.log(`    Risk: ${f.medicoLegalRisk}`);
  console.log(`    Auto-Text: "${f.autoText}"`);
  console.log(`    Impact: +${f.confidenceImpact/2} points`);
});

console.log("\n--- VALIDATION COMPLETE ---");
