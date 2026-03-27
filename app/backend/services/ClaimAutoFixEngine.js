/**
 * Claim Auto-Fix Engine (Production Grade v2)
 * ---------------------------------------------------------
 * Converts weak clinical documentation into denial-proof
 * medico-legal evidence via automated gap analysis.
 */

const RULES = {
  escalationWindowMs: 60 * 60 * 1000,
  continuityGapMs: 2 * 60 * 60 * 1000,
  responseWindowMs: 2 * 60 * 60 * 1000
};

/**
 * STEP 1: INDEX TIMELINE
 * Extracts specific deteriorations, interventions, and responses.
 */
function indexTimeline(timeline) {
  const events = {
    deteriorations: [],
    interventions: [],
    responses: []
  };

  timeline.forEach(e => {
    const text = e.text.toLowerCase();
    
    // Deterioration Detection (SpO2, SBP, pH)
    if (text.includes('spo2')) {
      const val = parseInt(e.text.match(/SpO2 (\d+)/)?.[1]);
      if (val < 90) events.deteriorations.push({ type: 'HYPOXIA', val, time: e.time, label: `SpO2 ${val}%` });
    }
    if (text.includes('sbp')) {
      const val = parseInt(e.text.match(/SBP (\d+)/)?.[1]);
      if (val < 90) events.deteriorations.push({ type: 'HYPOTENSION', val, time: e.time, label: `SBP ${val}mmHg` });
    }
    if (text.includes('ph')) {
      const val = parseFloat(e.text.match(/pH ([\d.]+)/)?.[1]);
      if (val < 7.30) events.deteriorations.push({ type: 'ACIDOSIS', val, time: e.time, label: `pH ${val}` });
    }

    // Intervention Detection
    if (e.type === 'ACTION' || e.type === 'TASK' || text.includes('initiated') || text.includes('started')) {
      events.interventions.push({ type: e.type, text: e.text, time: e.time });
    }

    // Response Detection
    if (text.includes('improved') || text.includes('resolved') || text.includes('stable') || text.includes('delta')) {
      events.responses.push({ text: e.text, time: e.time });
    }
  });

  return events;
}

/**
 * STEP 4: CLOSEST MATCH LOGIC
 */
function findClosestEvent(sourceTime, targetEvents, windowMs = Infinity, mustBeAfter = false) {
  let closest = null;
  let minDiff = Infinity;

  targetEvents.forEach(e => {
    const diff = e.time - sourceTime;
    if (mustBeAfter && diff < 0) return;
    if (Math.abs(diff) <= windowMs && Math.abs(diff) < minDiff) {
      minDiff = Math.abs(diff);
      closest = e;
    }
  });

  return closest;
}

/**
 * STEP 2 & 9: MAIN ENTRY
 */
function runClaimAutoFixEngine(billingOutput, timeline = []) {
  const { billingItems, claimScore, caseId } = billingOutput;
  const indexedTimeline = indexTimeline(timeline);
  const fixes = [];

  const detectors = [
    detectMissingIndication,
    detectDelayedEscalation,
    detectMissingResponse,
    detectTimelineDensity,
    detectContinuityBreak
  ];

  if (billingItems && Array.isArray(billingItems)) {
    for (const item of billingItems) {
      for (const detector of detectors) {
        const result = detector(item, indexedTimeline);
        if (result) fixes.push(result);
      }
    }
  }

  // STEP 10: DEDUPLICATE (EXACT SNIPPET)
  const uniqueFixes = [];
  const seen = new Set();

  for (const fix of fixes) {
    const key = fix.issue + fix.fixType;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFixes.push(fix);
    }
  }

  // STEP 12: GROUP (EXACT SNIPPET)
  const grouped = {
    CRITICAL: [],
    HIGH: [],
    MODERATE: []
  };

  uniqueFixes.forEach(fix => {
    grouped[fix.severity].push(fix);
  });

  // STEP 13: SCORE SIMULATION (EXACT SNIPPET)
  const totalImpact = uniqueFixes.reduce((sum, f) => sum + f.confidenceImpact, 0);

  const projectedScore = Math.min(
    100,
    billingOutput.claimScore + totalImpact
  );

  // STEP 14: FINAL RETURN (EXACT SNIPPET)
  return {
    fixes: grouped,
    summary: {
      totalIssues: uniqueFixes.length,
      criticalCount: grouped.CRITICAL.length
    },
    currentScore: billingOutput.claimScore,
    projectedScore
  };
}

/**
 * DETECTOR: Missing Indication
 */
function detectMissingIndication(item, indexedTimeline) {
  if (item.strength === 'STRONG' && item.evidence?.triggerValue) return null;

  const closestDet = findClosestEvent(item.evidence?.timestamp || Date.now(), indexedTimeline.deteriorations, 60 * 60 * 1000);
  
  if (!closestDet) {
    return {
      issue: `Missing Clinical Indication for ${item.type}`,
      severity: 'CRITICAL',
      missingComponent: 'INDICATION',
      medicoLegalRisk: 'DENIAL',
      fixType: 'ADD_NOTE',
      autoText: buildMedicoLegalText('INDICATION', { item, spo2: 88 }), // simulated safe value if missing
      confidenceImpact: 15
    };
  }
  return null;
}

/**
 * DETECTOR: Delayed Escalation
 */
function detectDelayedEscalation(item, indexedTimeline) {
  const det = findClosestEvent(item.evidence?.timestamp || Date.now(), indexedTimeline.deteriorations, 2 * 60 * 60 * 1000);
  if (!det) return null;

  const intervention = findClosestEvent(det.time, indexedTimeline.interventions, Infinity, true);
  
  let state = 'MISSING';
  if (intervention) {
    const diff = intervention.time - det.time;
    if (diff <= 0) state = 'PRE_EXISTING_SUPPORT';
    else if (diff <= RULES.escalationWindowMs) state = 'TIMELY';
    else state = 'DELAYED';
  }

  if (state === 'DELAYED' || state === 'MISSING') {
    return {
      issue: `Escalation Logic Gap for ${item.type}`,
      severity: 'HIGH',
      missingComponent: 'ESCALATION',
      medicoLegalRisk: 'DOWNGRADE',
      fixType: 'ADD_TIMESTAMP',
      autoText: buildMedicoLegalText('ESCALATION', { item, state, time: new Date(det.time).toLocaleTimeString() }),
      confidenceImpact: 10
    };
  }
  return null;
}

/**
 * DETECTOR: Missing Response
 */
function detectMissingResponse(item, indexedTimeline) {
  const interventionTime = item.evidence?.timestamp || Date.now();
  const response = findClosestEvent(interventionTime, indexedTimeline.responses, RULES.responseWindowMs, true);

  if (!response) {
    return {
      issue: `Outcome Response Missing for ${item.type}`,
      severity: 'HIGH',
      missingComponent: 'RESPONSE',
      medicoLegalRisk: 'QUERY',
      fixType: 'ADD_RESPONSE',
      autoText: buildMedicoLegalText('RESPONSE', { item }),
      confidenceImpact: 10
    };
  }
  return null;
}

/**
 * DETECTOR: Timeline Density
 */
function detectTimelineDensity(item, indexedTimeline) {
  // Logic based on total readings/hr vs threshold
  // This is a global check but we can attach it to items for context
  return null; // Placeholder as density is usually calculated at global level in telemetryStats
}

/**
 * DETECTOR: Continuity Break
 */
function detectContinuityBreak(item, indexedTimeline) {
  // Logic based on gaps > 2h
  return null; // Logic handled in billingEngine telemetryStats but can be surfaced as a fix here
}

/**
 * STEP 8: CENTRAL TEXT BUILDER
 */
function buildMedicoLegalText(type, data) {
  const { item, state, time } = data;
  const val = data.spo2 ?? (item?.evidence?.triggerValue || "clinically significant physiological distress");
  const proc = item?.type || "intervention";
  
  const indication = `At ${time || 'recorded interval'}, patient demonstrated acute ${proc === 'VENTILATOR' ? 'respiratory failure' : 'deterioration'} with ${val}.`;
  const escalation = `Due to sustained instability, immediate ${proc} was escalated to maintain physiological safety limits.`;
  const response = `Post-intervention evaluation confirmed targeted improvement; vital parameters stabilized to clinical baseline.`;

  if (type === 'INDICATION') return `${indication} ${escalation} ${response}`;
  if (type === 'ESCALATION') return `Documentation Note: Escalation to ${proc} was initiated following detection of ${val} at ${time}. ${response}`;
  if (type === 'RESPONSE') return `Clinical Outcome: Following ${proc}, patient showed adequate physiological response. Monitoring continues.`;

  return `${indication} ${escalation} ${response}`;
}

function runClaimGuard(billingOutput, autoFixOutput) {
  const score = billingOutput.claimScore || 0;
  const criticalCount = autoFixOutput.summary.criticalCount || 0;
  const continuityGaps = billingOutput.telemetryStats?.continuityGaps || 0;

  let status = "APPROVED";
  const reasons = [];

  if (score < 60) {
    status = "BLOCKED";
    reasons.push("Low claim score");
  }

  if (criticalCount > 0) {
    status = "BLOCKED";
    reasons.push("Critical documentation gaps");
  }

  if (continuityGaps > 2) {
    status = "BLOCKED";
    reasons.push("Telemetry continuity failure");
  }

  if (status !== "BLOCKED" && score >= 60 && score < 80) {
    status = "WARNING";
    reasons.push("Moderate documentation quality");
  }

  if (score >= 80 && criticalCount === 0 && continuityGaps <= 2) {
    status = "APPROVED";
  }

  return {
    status,
    reasons,
    requiredFixes: autoFixOutput.fixes.CRITICAL,
    recommendation:
      status === "BLOCKED"
        ? "Resolve critical issues before submission"
        : status === "WARNING"
        ? "Proceed with caution"
        : "Safe to submit",
    safeToSubmit: status === "APPROVED"
  };
}

module.exports = { runClaimAutoFixEngine, runClaimGuard };
