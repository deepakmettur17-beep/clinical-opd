/**
 * Closed-Loop Clinical Execution Engine (v2)
 * ---------------------------------------------------------
 * Tracks real-world bedside execution of clinical care steps
 * against protocol SLA targets with audit-accurate timestamps.
 *
 * Storage: Redis  →  key: execution:{caseId}
 * Socket alerts:
 *   sla_breach_critical   – MISSED IMMEDIATE step
 *   poor_compliance_alert – complianceScore < 70
 */

// ── SLA windows (milliseconds) ───────────────────────────────────────────
const SLA_MS = {
  IMMEDIATE:   5  * 60 * 1000,   //  5 min
  URGENT:      30 * 60 * 1000,   // 30 min
  SUPPORTIVE:  60 * 60 * 1000,   // 60 min
};

// ── Compliance deductions ─────────────────────────────────────────────────
const DEDUCTIONS = {
  MISSED_IMMEDIATE:   40,
  DELAYED_IMMEDIATE:  20,
  MISSED_URGENT:      20,
  DELAYED_URGENT:     10,
  MISSED_SUPPORTIVE:  10,
};

// ── Redis key helper ──────────────────────────────────────────────────────
const redisKey = (caseId) => `execution:${caseId}`;

/**
 * Determine the SLA category for a pathway step.
 * Falls back to SUPPORTIVE if the category does not match.
 */
function getSlaCategory(category = '') {
  if (category.includes('IMMEDIATE'))           return 'IMMEDIATE';
  if (category.includes('URGENT'))              return 'URGENT';
  if (category.includes('STEP_3') || category.includes('STEP_4') || category.includes('STEP_5')) return 'IMMEDIATE';
  if (category.includes('STEP_2'))              return 'URGENT';
  if (category.includes('CARDIOGENIC') || category.includes('OBSTRUCTIVE')) return 'URGENT';
  return 'SUPPORTIVE';
}

/**
 * Compute the status of a single step:
 * - COMPLETED  → done within SLA
 * - DELAYED    → done after SLA
 * - MISSED     → still pending past SLA × 1.5 buffer
 * - PENDING    → assigned, SLA not yet breached
 */
function computeStepStatus(step, now = Date.now()) {
  const slaMs  = SLA_MS[step.slaCategory] || SLA_MS.SUPPORTIVE;
  const base   = step.assignedAt;

  if (step.completedAt) {
    const timeTaken = step.completedAt - base;
    return timeTaken <= slaMs ? 'COMPLETED' : 'DELAYED';
  }

  // Not completed – check for MISSED
  if (now - base > slaMs * 1.5) return 'MISSED';
  return 'PENDING';
}

/**
 * Assign a new step to an execution log (called when pathway is triggered).
 * If a test (redisClient) is provided, persists to Redis.
 */
async function assignStep(caseId, step, redisClient) {
  const slaCategory = getSlaCategory(step.category);
  const record = {
    stepId:      step.step,
    label:       step.task,
    category:    step.category,
    slaCategory,
    slaMs:       SLA_MS[slaCategory],
    assignedAt:  Date.now(),
    completedAt: null,
    completedBy: null,
    status:      'PENDING',
  };

  if (redisClient) {
    try {
      await redisClient.rPush(redisKey(caseId), JSON.stringify(record));
    } catch (e) {
      // Redis write failure – non-fatal, fall back to in-memory
    }
  }
  return record;
}

/**
 * Mark a step as completed.
 * Updates the record in Redis and returns the updated record + new compliance.
 */
async function completeStep(caseId, stepIndex, completedBy, redisClient, inMemoryLogs) {
  const now = Date.now();
  let logs;

  if (redisClient) {
    try {
      const raw = await redisClient.lRange(redisKey(caseId), 0, -1);
      logs = raw.map(r => JSON.parse(r));
    } catch (e) {
      logs = null;
    }
  }

  // Fall back to in-memory
  if (!logs) {
    logs = inMemoryLogs ? [...inMemoryLogs] : [];
  }

  if (!logs[stepIndex]) return null;

  logs[stepIndex].completedAt = now;
  logs[stepIndex].completedBy = completedBy || 'Clinician';
  logs[stepIndex].status      = computeStepStatus(logs[stepIndex], now);

  // Write back
  if (redisClient) {
    try {
      await redisClient.lSet(redisKey(caseId), stepIndex, JSON.stringify(logs[stepIndex]));
    } catch (e) { /* non-fatal */ }
  }

  return { updatedStep: logs[stepIndex], logs };
}

/**
 * Run full compliance analysis across all logs for a given caseId.
 * Returns the compliance report + any critical alerts.
 */
async function runComplianceAnalysis(caseId, redisClient, inMemoryLogs) {
  const now = Date.now();
  let logs;

  if (redisClient) {
    try {
      const raw = await redisClient.lRange(redisKey(caseId), 0, -1);
      logs = raw.map(r => JSON.parse(r));
    } catch (e) {
      logs = null;
    }
  }

  if (!logs) logs = inMemoryLogs || [];
  if (logs.length === 0) return null;

  let complianceScore  = 100;
  const delayedSteps   = [];
  const missedSteps    = [];
  const criticalAlerts = [];
  let completedCount   = 0;

  for (const step of logs) {
    // Re-evaluate status with current timestamp
    step.status = computeStepStatus(step, now);

    if (step.status === 'COMPLETED') {
      completedCount++;

    } else if (step.status === 'DELAYED') {
      completedCount++;
      const delayMins = Math.round((step.completedAt - step.assignedAt - step.slaMs) / 60000);
      delayedSteps.push({ label: step.label, category: step.slaCategory, delayMins });

      if      (step.slaCategory === 'IMMEDIATE') complianceScore -= DEDUCTIONS.DELAYED_IMMEDIATE;
      else if (step.slaCategory === 'URGENT')    complianceScore -= DEDUCTIONS.DELAYED_URGENT;

    } else if (step.status === 'MISSED') {
      missedSteps.push({ label: step.label, category: step.slaCategory });

      if (step.slaCategory === 'IMMEDIATE') {
        complianceScore -= DEDUCTIONS.MISSED_IMMEDIATE;
        criticalAlerts.push({
          type:    'sla_breach_critical',
          message: `⚠️ IMMEDIATE step missed: "${step.label}"`,
          step:    step.label,
        });
      } else if (step.slaCategory === 'URGENT') {
        complianceScore -= DEDUCTIONS.MISSED_URGENT;
      } else {
        complianceScore -= DEDUCTIONS.MISSED_SUPPORTIVE;
      }
    }
  }

  complianceScore = Math.max(0, Math.min(100, Math.round(complianceScore)));

  // Step timeline for UI — one entry per log with audit-accurate timestamps
  const stepTimeline = logs.map((step, i) => ({
    index:       i,
    label:       step.label,
    slaCategory: step.slaCategory,
    status:      step.status,
    assignedAt:  step.assignedAt,
    completedAt: step.completedAt || null,
    completedBy: step.completedBy || null,
    slaMs:       step.slaMs,
    timeTakenMs: step.completedAt ? step.completedAt - step.assignedAt : null,
    delayMs:     step.completedAt && step.completedAt - step.assignedAt > step.slaMs
                   ? (step.completedAt - step.assignedAt - step.slaMs)
                   : null,
  }));

  const report = {
    completionRate:  logs.length > 0 ? Math.round((completedCount / logs.length) * 100) : 0,
    delayedSteps,
    missedSteps,
    complianceScore,
    // Updated thresholds: >90 = GREEN, 70–90 = YELLOW, <70 = RED
    status:          complianceScore > 90 ? 'SUCCESS' : complianceScore >= 70 ? 'WARNING' : 'CRITICAL',
    criticalAlerts,
    poorCompliance:  complianceScore < 70,
    stepTimeline,
    totalSteps:      logs.length,
    completedCount,
  };

  return report;
}

/**
 * Initialize execution log for a new pathway (bulk assign all steps).
 */
async function initPathwayLog(caseId, checklist, redisClient) {
  // Clear previous logs for this case
  if (redisClient) {
    try { await redisClient.del(redisKey(caseId)); } catch (e) { /* non-fatal */ }
  }
  const records = [];
  for (const step of checklist) {
    const record = await assignStep(caseId, step, redisClient);
    records.push(record);
  }
  return records;
}

/**
 * Retrieve raw execution log from Redis (or in-memory fallback).
 */
async function getExecutionLog(caseId, redisClient, inMemoryLogs) {
  if (redisClient) {
    try {
      const raw = await redisClient.lRange(redisKey(caseId), 0, -1);
      if (raw && raw.length > 0) return raw.map(r => JSON.parse(r));
    } catch (e) { /* non-fatal */ }
  }
  return inMemoryLogs || [];
}

module.exports = {
  SLA_MS,
  DEDUCTIONS,
  getSlaCategory,
  computeStepStatus,
  assignStep,
  completeStep,
  runComplianceAnalysis,
  initPathwayLog,
  getExecutionLog,
};
