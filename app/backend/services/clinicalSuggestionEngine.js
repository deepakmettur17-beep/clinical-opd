/**
 * Smart Clinical Suggestion Engine
 * ---------------------------------------------------------
 * Proactively guides clinicians to the highest-priority
 * next action based on pathway state, execution gaps,
 * predictive risk, and vital trends.
 *
 * SAFETY: Decision-support ONLY — no auto-execution.
 * All outputs carry explicit reasoning for transparency.
 */

const INACTIVITY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ── Priority weights for sorting ─────────────────────────────────────────
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
 * Core engine — returns topSuggestion, secondarySuggestions, reason.
 *
 * @param {object} pathway         — clinicalPathway from predictiveIntel
 * @param {Array}  executionLogs   — step logs with { status, slaCategory, label, assignedAt, completedAt }
 * @param {string} predictedRisk   — 'HIGH' | 'MODERATE' | 'LOW'
 * @param {number} riskScore       — 0–100
 * @param {object} vitals          — { spo2, rr, hr, sbp, abg }
 * @param {number} lastActionAt    — timestamp of the last completed step
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

  // ── 1. IMMEDIATE steps pending or missed ─────────────────────────────────
  executionLogs.forEach((step, i) => {
    if (step.status === 'MISSED' && step.slaCategory === 'IMMEDIATE') {
      suggestions.push(makeSuggestion(
        `⚠️ Urgent: Complete "${step.label}" immediately`,
        `This IMMEDIATE step is MISSED — it was due within 5 min and has not been done. Patient safety is at risk.`,
        'CRITICAL',
        'SLA_BREACH',
        i
      ));
    } else if (step.status === 'PENDING' && step.slaCategory === 'IMMEDIATE') {
      const elapsedMins = Math.round((now - step.assignedAt) / 60000);
      suggestions.push(makeSuggestion(
        `▶ Perform now: "${step.label}"`,
        `IMMEDIATE protocol step — SLA: 5 min. Elapsed so far: ${elapsedMins} min.`,
        'CRITICAL',
        'PATHWAY_IMMEDIATE',
        i
      ));
    }
  });

  // ── 2. Escalate delayed steps ─────────────────────────────────────────────
  executionLogs.forEach((step, i) => {
    if (step.status === 'DELAYED') {
      const overrunMins = step.completedAt
        ? Math.round((step.completedAt - step.assignedAt - step.slaMs) / 60000)
        : Math.round((now - step.assignedAt) / 60000);
      suggestions.push(makeSuggestion(
        `📋 Follow-up needed: "${step.label}" (${overrunMins} min over SLA)`,
        `This ${step.slaCategory} step was completed late or is still running past SLA. Escalate monitoring.`,
        'HIGH',
        'SLA_DELAY',
        i
      ));
    }
  });

  // ── 3. High predictive risk → preemptive actions ─────────────────────────
  if (predictedRisk === 'HIGH') {
    const { spo2, rr, hr, abg } = vitals || {};

    if (spo2 !== undefined && spo2 < 92) {
      suggestions.push(makeSuggestion(
        '🫁 Increase FiO₂ / escalate oxygen support',
        `SpO₂ is ${spo2}% with HIGH predicted risk. Pre-empt hypoxic failure before it occurs.`,
        'HIGH',
        'PREDICTIVE_ENGINE'
      ));
    }
    if (rr !== undefined && rr > 24) {
      suggestions.push(makeSuggestion(
        '🌬 Consider NIV / Respiratory support escalation',
        `RR is ${rr} breaths/min (HIGH risk). Elevated RR predicts impending respiratory failure.`,
        'HIGH',
        'PREDICTIVE_ENGINE'
      ));
    }
    if (hr !== undefined && hr > 110) {
      suggestions.push(makeSuggestion(
        '💉 Assess for shock — consider fluids or vasopressors',
        `HR is ${hr} bpm with HIGH risk. Tachycardia may indicate evolving shock.`,
        'HIGH',
        'PREDICTIVE_ENGINE'
      ));
    }
    if (abg?.ph !== undefined && parseFloat(abg.ph) < 7.30) {
      suggestions.push(makeSuggestion(
        '🔬 Review ventilation: pH acidotic — consider increasing RR or tidal volume',
        `pH ${abg.ph} is below 7.30 with HIGH risk score (${riskScore}). Ventilation failure may be developing.`,
        'HIGH',
        'PREDICTIVE_ENGINE'
      ));
    }

    if (suggestions.length === 0) {
      suggestions.push(makeSuggestion(
        '🔴 HIGH risk detected — re-assess patient immediately',
        `Risk score is ${riskScore}. No specific vital trigger found but overall risk is HIGH. Full clinical review recommended.`,
        'HIGH',
        'PREDICTIVE_ENGINE'
      ));
    }
  }

  // ── 4. No action for 5 min → suggest next best step ─────────────────────
  const inactiveMs = lastActionAt ? now - lastActionAt : now - (executionLogs[0]?.assignedAt || now);
  if (inactiveMs > INACTIVITY_THRESHOLD_MS) {
    const nextPending = executionLogs.find(
      s => s.status === 'PENDING' && s.slaCategory !== 'SUPPORTIVE'
    ) || executionLogs.find(s => s.status === 'PENDING');

    if (nextPending) {
      const inactiveMins = Math.round(inactiveMs / 60000);
      suggestions.push(makeSuggestion(
        `⏱ No action for ${inactiveMins} min — consider: "${nextPending.label}"`,
        `Protocol step has not been actioned in ${inactiveMins} minutes. Clinical workflow may have stalled.`,
        'MODERATE',
        'INACTIVITY_PROMPT',
        executionLogs.indexOf(nextPending)
      ));
    }
  }

  // ── 5. Also suggest next URGENT/SUPPORTIVE pending steps ─────────────────
  executionLogs.forEach((step, i) => {
    if (step.status === 'PENDING' && step.slaCategory === 'URGENT') {
      const elapsedMins = Math.round((now - step.assignedAt) / 60000);
      suggestions.push(makeSuggestion(
        `📌 Next: "${step.label}"`,
        `URGENT step pending for ${elapsedMins} min (SLA: 30 min). Complete before it becomes overdue.`,
        'MODERATE',
        'PATHWAY_URGENT',
        i
      ));
    }
  });

  // ── Sort by priority ──────────────────────────────────────────────────────
  suggestions.sort((a, b) =>
    (PRIORITY_ORDER[a.urgency] ?? 9) - (PRIORITY_ORDER[b.urgency] ?? 9)
  );

  // ── De-duplicate by stepIndex (keep highest urgency per step) ────────────
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
            `✅ Pathway progressing — ${remaining} step(s) remaining`,
            'All active steps are within SLA. Continue monitoring and complete remaining protocol steps.',
            'LOW',
            'ALL_CLEAR'
          )
        : makeSuggestion(
            '✅ Protocol complete — patient stable, continue monitoring',
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
