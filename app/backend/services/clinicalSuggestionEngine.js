/**
 * Smart Clinical Suggestion Engine
 * ---------------------------------------------------------
 * Proactively guides clinicians to the highest-priority
 * next action based on pathway state, execution gaps,
 * predictive risk, and vital trends.
 *
 * SAFETY: Decision-support ONLY â€” no auto-execution.
 * All outputs carry explicit reasoning for transparency.
 */

const INACTIVITY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// â”€â”€ Priority weights for sorting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };

/**
 * Classify urgency of a pending/delayed step.
 */
function classifyStepUrgency(step) {
  if (step.status === 'MISSED')   return 'CRITICAL';
  if (step.slaCategory === 'IMMEDIATE' && step.status === 'PENDING')  return 'CRITICAL';
  if (step.status === 'DELAYED')  return 'HIGH';
  if (step.slaCategory === 'URGENT' && step.status === 'PENDING')     return 'MODERATE';
  return 'LOW';
}

/**
 * Build a suggestion object with consistent structure.
 */
function makeSuggestion(action, reason, urgency, source, stepIndex = null) {
  return { action, reason, urgency, source, stepIndex };
}

/**
 * Core engine â€” returns topSuggestion, secondarySuggestions, reason.
 *
 * @param {object} pathway         â€” clinicalPathway from predictiveIntel
 * @param {Array}  executionLogs   â€” step logs with { status, slaCategory, label, assignedAt, completedAt }
 * @param {string} predictedRisk   â€” 'HIGH' | 'MODERATE' | 'LOW'
 * @param {number} riskScore       â€” 0â€“100
 * @param {object} vitals          â€” { spo2, rr, hr, sbp, abg }
 * @param {number} lastActionAt    â€” timestamp of the last completed step
 */
function runSuggestionEngine({
  pathway,
  executionLogs = [],
  predictedRisk = 'LOW',
  riskScore = 0,
  vitals = {},
  lastActionAt = null,
}) {
  const now = Date.now();
  const suggestions = [];

  // â”€â”€ 1. IMMEDIATE steps pending or missed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  executionLogs.forEach((step, i) => {
    if (step.status === 'MISSED' && step.slaCategory === 'IMMEDIATE') {
      suggestions.push(makeSuggestion(
        `âš ï¸ Urgent: Complete "${step.label}" immediately`,
        `This IMMEDIATE step is MISSED â€” it was due within 5 min and has not been done. Patient safety is at risk.`,
        'CRITICAL',
        'SLA_BREACH',
        i
      ));
    } else if (step.status === 'PENDING' && step.slaCategory === 'IMMEDIATE') {
      const elapsedMins = Math.round((now - step.assignedAt) / 60000);
      suggestions.push(makeSuggestion(
        `â–¶ Perform now: "${step.label}"`,
        `IMMEDIATE protocol step â€” SLA: 5 min. Elapsed so far: ${elapsedMins} min.`,
        'CRITICAL',
        'PATHWAY_IMMEDIATE',
        i
      ));
    }
  });

  // â”€â”€ 2. Escalate delayed steps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  executionLogs.forEach((step, i) => {
    if (step.status === 'DELAYED') {
      const overrunMins = step.completedAt
        ? Math.round((step.completedAt - step.assignedAt - step.slaMs) / 60000)
        : Math.round((now - step.assignedAt) / 60000);
      suggestions.push(makeSuggestion(
        `ðŸ“‹ Follow-up needed: "${step.label}" (${overrunMins} min over SLA)`,
        `This ${step.slaCategory} step was completed late or is still running past SLA. Escalate monitoring.`,
        'HIGH',
        'SLA_DELAY',
        i
      ));
    }
  });

  // â”€â”€ 3. High predictive risk â†’ preemptive actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (predictedRisk === 'HIGH') {
    const { spo2, rr, hr, abg } = vitals || {};

    if (spo2 !== undefined && spo2 < 92) {
      suggestions.push(makeSuggestion(
        'ðŸ« Increase FiOâ‚‚ / escalate oxygen support',
        `SpOâ‚‚ is ${spo2}% with HIGH predicted risk. Pre-empt hypoxic failure before it occurs.`,
        'HIGH',
        'PREDICTIVE_ENGINE'
      ));
    }
    if (rr !== undefined && rr > 24) {
      suggestions.push(makeSuggestion(
        'ðŸŒ¬ Consider NIV / Respiratory support escalation',
        `RR is ${rr} breaths/min (HIGH risk). Elevated RR predicts impending respiratory failure.`,
        'HIGH',
        'PREDICTIVE_ENGINE'
      ));
    }
    if (hr !== undefined && hr > 110) {
      suggestions.push(makeSuggestion(
        'ðŸ’‰ Assess for shock â€” consider fluids or vasopressors',
        `HR is ${hr} bpm with HIGH risk. Tachycardia may indicate evolving shock.`,
        'HIGH',
        'PREDICTIVE_ENGINE'
      ));
    }
    if (abg?.ph !== undefined && parseFloat(abg.ph) < 7.30) {
      suggestions.push(makeSuggestion(
        'ðŸ”¬ Review ventilation: pH acidotic â€” consider increasing RR or tidal volume',
        `pH ${abg.ph} is below 7.30 with HIGH risk score (${riskScore}). Ventilation failure may be developing.`,
        'HIGH',
        'PREDICTIVE_ENGINE'
      ));
    }

    if (suggestions.length === 0) {
      suggestions.push(makeSuggestion(
        'ðŸ”´ HIGH risk detected â€” re-assess patient immediately',
        `Risk score is ${riskScore}. No specific vital trigger found but overall risk is HIGH. Full clinical review recommended.`,
        'HIGH',
        'PREDICTIVE_ENGINE'
      ));
    }
  }

  // â”€â”€ 4. No action for 5 min â†’ suggest next best step â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const inactiveMs = lastActionAt ? now - lastActionAt : now - (executionLogs[0]?.assignedAt || now);
  if (inactiveMs > INACTIVITY_THRESHOLD_MS) {
    const nextPending = executionLogs.find(
      s => s.status === 'PENDING' && s.slaCategory !== 'SUPPORTIVE'
    ) || executionLogs.find(s => s.status === 'PENDING');

    if (nextPending) {
      const inactiveMins = Math.round(inactiveMs / 60000);
      suggestions.push(makeSuggestion(
        `â± No action for ${inactiveMins} min â€” consider: "${nextPending.label}"`,
        `Protocol step has not been actioned in ${inactiveMins} minutes. Clinical workflow may have stalled.`,
        'MODERATE',
        'INACTIVITY_PROMPT',
        executionLogs.indexOf(nextPending)
      ));
    }
  }

  // â”€â”€ 5. Also suggest next URGENT/SUPPORTIVE pending steps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  executionLogs.forEach((step, i) => {
    if (step.status === 'PENDING' && step.slaCategory === 'URGENT') {
      const elapsedMins = Math.round((now - step.assignedAt) / 60000);
      suggestions.push(makeSuggestion(
        `ðŸ“Œ Next: "${step.label}"`,
        `URGENT step pending for ${elapsedMins} min (SLA: 30 min). Complete before it becomes overdue.`,
        'MODERATE',
        'PATHWAY_URGENT',
        i
      ));
    }
  });

  // â”€â”€ Sort by priority â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  suggestions.sort((a, b) =>
    (PRIORITY_ORDER[a.urgency] ?? 9) - (PRIORITY_ORDER[b.urgency] ?? 9)
  );

  // â”€â”€ De-duplicate by stepIndex (keep highest urgency per step) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const seen = new Set();
  const deduped = suggestions.filter(s => {
    if (s.stepIndex === null || s.stepIndex === undefined) return true;
    if (seen.has(s.stepIndex)) return false;
    seen.add(s.stepIndex);
    return true;
  });

  if (deduped.length === 0) {
    // All clear suggestion
    const remaining = executionLogs.filter(s => s.status === 'PENDING').length;
    return {
      topSuggestion: remaining > 0
        ? makeSuggestion(
            `âœ… Pathway progressing â€” ${remaining} step(s) remaining`,
            'All active steps are within SLA. Continue monitoring and complete remaining protocol steps.',
            'LOW',
            'ALL_CLEAR'
          )
        : makeSuggestion(
            'âœ… Protocol complete â€” patient stable, continue monitoring',
            'All pathway steps have been completed. Reassess vitals and escalate if condition changes.',
            'LOW',
            'ALL_CLEAR'
          ),
      secondarySuggestions: [],
      reason: 'No active SLA breaches or high-risk indicators detected.',
    };
  }

  return {
    topSuggestion:          deduped[0],
    secondarySuggestions:   deduped.slice(1, 3), // max 2 secondary
    reason: `${deduped.length} suggestion(s) generated based on pathway state, SLA tracking, and predictive risk.`,
  };
}

module.exports = { runSuggestionEngine };