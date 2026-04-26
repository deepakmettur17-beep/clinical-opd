/**
 * historyValidator.js â€” Hardened v2
 * Fail-safe, deduplicated, and medico-legal compliant.
 */
function validateHistory(historyTemplate, userAnswers) {
  // FAIL-SAFE: always return array, never throw
  if (!historyTemplate) return [];

  // Null-safe normalisation â€” supports: object, array, null, undefined
  let answered = [];
  if (Array.isArray(userAnswers)) {
    answered = userAnswers
      .filter(a => a != null)
      .map(a => String(a).toLowerCase());
  } else if (userAnswers && typeof userAnswers === 'object') {
    answered = Object.keys(userAnswers).map(k => k.toLowerCase());
  }
  // Else: answered stays [] â€” will surface all gaps

  const coreQuestions       = historyTemplate.coreQuestions       || [];
  const redFlags            = historyTemplate.redFlags             || [];
  const mandatoryBackground = historyTemplate.mandatoryBackground  || [];

  const gaps = new Set(); // deduplicate via Set

  // Core HPI questions
  coreQuestions.forEach(q => {
    if (!answered.includes(q.toLowerCase())) {
      gaps.add(`${q} not assessed`);
    }
  });

  // Red-flag questions
  redFlags.forEach(f => {
    if (!answered.includes(f.toLowerCase())) {
      gaps.add(`${f} not asked (critical red flag)`);
    }
  });

  // Mandatory background (global + template-specific, deduplicated)
  const globalMandatory = [
    'Past medical history', 'Surgical history',
    'Drug allergy', 'Current medications', 'Habits'
  ];
  const combinedMandatory = [...new Set([...mandatoryBackground, ...globalMandatory])];

  combinedMandatory.forEach(bg => {
    let hasValue = false;
    if (Array.isArray(userAnswers)) {
      hasValue = answered.includes(bg.toLowerCase());
    } else if (userAnswers && typeof userAnswers === 'object') {
      const key = Object.keys(userAnswers).find(k => k.toLowerCase() === bg.toLowerCase());
      if (key) {
        const val = userAnswers[key];
        hasValue = val !== undefined && val !== null && String(val).trim() !== '';
      }
    }
    if (!hasValue) {
      gaps.add(`${bg} not documented (medico-legal risk)`);
    }
  });

  const missingCriticalQuestions = [...gaps];

  // MEDICO-LEGAL HARDENING: append risk disclaimer when gaps exist
  if (missingCriticalQuestions.length > 0) {
    missingCriticalQuestions.push(
      'Incomplete history â€” clinical risk cannot be fully excluded'
    );
  }

  return missingCriticalQuestions;
}

module.exports = { validateHistory };