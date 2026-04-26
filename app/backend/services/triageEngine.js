/**
 * Hospital Triage Priority Engine
 * ---------------------------------------------------------
 * Evaluates all active patients and sorts them by computed
 * triage score so consultants know WHO to see first.
 *
 * SAFETY: Decision-support only â€” no auto-action.
 *
 * Inputs per patient:
 *   - predictiveRisk     ('HIGH' | 'MODERATE' | 'LOW')
 *   - riskScore          (0â€“100)
 *   - priorityLevel      ('IMMEDIATE' | 'URGENT' | 'ROUTINE')
 *   - complianceScore    (0â€“100)
 *   - missedImmediateCount (integer)
 *   - lastActionAt       (ms timestamp or null)
 *   - caseId, patientName
 *
 * Output array sorted by triageScore descending:
 *   [ { caseId, patientName, triageScore, urgency, reason } ]
 */

const INACTIVITY_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Compute triage score for a single patient.
 * Returns { triageScore, reasons[] }
 */
function computeTriageScore({
  predictiveRisk    = 'LOW',
  priorityLevel     = 'ROUTINE',
  complianceScore   = 100,
  missedImmediateCount = 0,
  lastActionAt      = null,
}) {
  let score   = 0;
  const reasons = [];

  // Predictive risk
  if (predictiveRisk === 'HIGH') {
    score += 3;
    reasons.push('High predicted deterioration risk (+3)');
  } else if (predictiveRisk === 'MODERATE') {
    score += 1;
    reasons.push('Moderate predictive risk (+1)');
  }

  // Clinical priority level
  if (priorityLevel === 'IMMEDIATE') {
    score += 3;
    reasons.push('IMMEDIATE action required (+3)');
  } else if (priorityLevel === 'URGENT') {
    score += 1;
    reasons.push('URGENT protocol active (+1)');
  }

  // Poor compliance
  if (complianceScore < 70) {
    score += 2;
    reasons.push(`Compliance score ${complianceScore}/100 â€” below threshold (+2)`);
  }

  // Missed IMMEDIATE steps
  if (missedImmediateCount > 0) {
    score += 3;
    reasons.push(`${missedImmediateCount} IMMEDIATE step(s) missed (+3)`);
  }

  // Clinical inactivity
  if (lastActionAt !== null) {
    const inactiveMs = Date.now() - lastActionAt;
    if (inactiveMs > INACTIVITY_THRESHOLD_MS) {
      score += 2;
      const inactiveMins = Math.round(inactiveMs / 60000);
      reasons.push(`No clinical action for ${inactiveMins} min (+2)`);
    }
  }

  return { triageScore: score, reasons };
}

/**
 * Classify urgency tier from triage score and top-20% threshold.
 */
function classifyUrgency(triageScore, maxScore) {
  const top20Threshold = maxScore * 0.8; // top 20% = score >= 80% of max
  if (triageScore >= 7 || (maxScore > 0 && triageScore >= top20Threshold)) return 'CRITICAL';
  if (triageScore >= 4) return 'HIGH';
  return 'MODERATE';
}

/**
 * Main engine â€” takes an array of patient data, returns sorted triage list.
 *
 * @param {Array} patients â€” array of patient objects with required fields
 * @returns {Array} sorted triage list
 */
function runTriageEngine(patients = []) {
  if (!patients || patients.length === 0) return [];

  // Compute scores
  const scored = patients.map(pt => {
    const { triageScore, reasons } = computeTriageScore({
      predictiveRisk:      pt.predictiveRisk,
      priorityLevel:       pt.priorityLevel,
      complianceScore:     pt.complianceScore,
      missedImmediateCount: pt.missedImmediateCount || 0,
      lastActionAt:        pt.lastActionAt,
    });

    return {
      caseId:      pt.caseId,
      patientName: pt.patientName || 'Unknown Patient',
      diagnosis:   pt.diagnosis || 'Unspecified',
      ward:        pt.ward || null,
      triageScore,
      reasons,
      predictiveRisk:  pt.predictiveRisk || 'LOW',
      riskScore:       pt.riskScore || 0,
      priorityLevel:   pt.priorityLevel || 'ROUTINE',
      complianceScore: pt.complianceScore ?? 100,
      lastActionAt:    pt.lastActionAt || null,
    };
  });

  // Sort descending by triage score
  scored.sort((a, b) => b.triageScore - a.triageScore);

  const maxScore = scored.length > 0 ? scored[0].triageScore : 0;

  // Assign urgency
  return scored.map(pt => ({
    ...pt,
    urgency: classifyUrgency(pt.triageScore, maxScore),
    reason:  pt.reasons.length > 0 ? pt.reasons.join('; ') : 'No active risk flags',
  }));
}

module.exports = { runTriageEngine, computeTriageScore, classifyUrgency };