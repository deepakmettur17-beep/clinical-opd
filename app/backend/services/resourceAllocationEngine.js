/**
 * Resource Allocation Engine (Upgraded)
 * ---------------------------------------------------------
 * Analyzes hospital-wide triage data to prioritize ICU beds
 * and detect ventilator needs + system overload.
 */

const getICUPriority = (pt) => {
  const intel = pt.fullData?.ventilatorStatus?.predictiveIntel || {};
  const failureType = intel.actionPriority?.failureType || '';
  const vitals = pt.fullData?.vitals || {};
  const spo2 = parseFloat(vitals.spo2) || 100;

  // RULE 1: Clinical Overrides (Priority 1)
  if (spo2 < 85 && spo2 > 0) return 1;
  if (failureType === "Shock" || failureType === "Ventilation Failure") return 1;

  // RULE 2: High Severity + High Score (Priority 1)
  if (pt.severity === "Critical" && pt.triageScore >= 7) return 1;

  // RULE 3: Moderate Risk (Priority 2)
  if (pt.triageScore >= 5) return 2;

  // RULE 4: Standard (Priority 3)
  return 3;
};

const needsVentilator = (pt) => {
  const vitals = pt.fullData?.vitals || {};
  const abg = vitals.abg || {};
  const spo2 = parseFloat(vitals.spo2) || 100;
  const ph = parseFloat(abg.ph) || 7.4;
  const pco2 = parseFloat(abg.pco2) || 40;
  const intel = pt.fullData?.ventilatorStatus?.predictiveIntel || {};
  const failureType = intel.actionPriority?.failureType || '';

  // Logic: SpO2 < 88 OR (pH < 7.30 AND PaCO2 > 50) OR failureType === "Ventilation Failure"
  if (spo2 < 88 && spo2 > 0) return true;
  if (ph < 7.30 && pco2 > 50) return true;
  if (failureType === "Ventilation Failure") return true;

  return false;
};

const buildReason = (pt) => {
  const reasons = [];
  const vitals = pt.fullData?.vitals || {};
  const abg = vitals.abg || {};
  const spo2 = parseFloat(vitals.spo2) || 100;
  const ph = parseFloat(abg.ph) || 7.4;
  const pco2 = parseFloat(abg.pco2) || 40;
  const intel = pt.fullData?.ventilatorStatus?.predictiveIntel || {};
  
  if (spo2 < 90 && spo2 > 0) reasons.push("Low SpO2");
  if (intel.predictedRisk === "HIGH") reasons.push("High predictive risk");
  
  // Note: missedImmediate calculation requires compliance summary
  // Assuming it might be passed or derived from pt summary if available
  if (pt.missedImmediateCount > 0) reasons.push("Missed critical steps");
  
  if (pco2 > 50 && ph < 7.35) reasons.push("Ventilation failure pattern");

  return reasons.length > 0 ? reasons.join(", ") : "Routine monitoring";
};

const runResourceAllocation = (patients = []) => {
  const icuQueue = [];
  const ventilatorQueue = [];
  const overloadWarnings = [];
  const locationStats = {};

  patients.forEach(pt => {
    // Standardize fields if missing
    const score = pt.triageScore || 0;
    const priority = getICUPriority(pt);
    const reason = buildReason(pt);

    // 1. ICU Queue
    icuQueue.push({
      caseId: pt.caseId,
      name: pt.patientName,
      priority,
      score,
      reason
    });

    // 2. Ventilator Queue
    if (needsVentilator(pt)) {
      ventilatorQueue.push({
        caseId: pt.caseId,
        name: pt.patientName,
        priority,
        score,
        reason
      });
    }

    // 3. Overload Logic
    const loc = (pt.ward || pt.location || 'ER').toUpperCase();
    if (pt.urgency === 'CRITICAL' || pt.severity === 'Critical') {
      locationStats[loc] = (locationStats[loc] || 0) + 1;
      if (locationStats[loc] > 3) {
        if (!overloadWarnings.find(w => w.location === loc)) {
          overloadWarnings.push({
            location: loc,
            count: locationStats[loc],
            recommendation: "Shift patients to ICU / call backup",
            message: `ðŸ”¥ OVERLOAD: ${locationStats[loc]} Critical cases in ${loc}`
          });
        }
      }
    }
  });

  // Sort ICU Queue: Priority 1 -> 3
  icuQueue.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.score - a.score;
  });

  return {
    icuQueue,
    ventilatorQueue,
    overloadWarnings,
    timestamp: Date.now()
  };
};

module.exports = { runResourceAllocation, getICUPriority, needsVentilator, buildReason };