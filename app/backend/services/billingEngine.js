/**
 * Billing + Claim Intelligence Engine (Production v3.2)
 * ---------------------------------------------------------
 * Automates revenue capture and protects against denials 
 * by tying every charge to clinical evidence and outcomes.
 */

const { buildUnifiedTimeline } = require('./dischargeEngine');

async function generateBillingIntelligence(caseId, redisClient) {
  if (!redisClient) return { error: "Redis client missing" };

  try {
    const timeline = await buildUnifiedTimeline(caseId, redisClient);
    const patientRaw = await redisClient.get(`patient:${caseId}`);
    const pt = patientRaw ? JSON.parse(patientRaw) : null;

    if (timeline.length === 0) return { error: "No clinical data found" };

    // 1. Detect Physiological Deteriorations
    const deteriorations = detectDeteriorations(timeline);

    // 2. Build Event Chains (Escalation Validation)
    const chains = buildEventChains(deteriorations, timeline);

    // 3. Response Validation
    const validatedChains = validateResponses(chains, timeline);

    // 4. Continuity + Density
    const telemetryStats = calculateTelemetryStats(timeline);

    // 5. Compute Durations & Slabs
    const billingUnits = computeBillingUnits(timeline, pt);

    // 6. Generate Billing Items + Defense Blocks
    const billingItems = generateBillingItems(billingUnits, validatedChains);

    // 7. Claim Strength & Score
    const scoring = calculateClaimScores(billingItems, telemetryStats, timeline);

    // 8. Overbilling & Revenue Leaks
    const risks = detectRisks(billingItems, validatedChains, timeline);

    const finalOutput = {
      caseId,
      patientName: pt?.patientName,
      billingItems,
      claimScore: scoring.globalScore,
      confidenceScore: scoring.confidenceScore,
      denialRisks: risks.denialRisks,
      revenueLeaks: risks.revenueLeaks,
      telemetryStats,
      timeline, // Include full timeline for auto-fix analysis
      generatedAt: Date.now()
    };

    return finalOutput;
  } catch (err) {
    console.error("Billing Engine Error:", err);
    return { error: err.message };
  }
}

function detectDeteriorations(timeline) {
  const dets = [];
  // Focus on vitals and notes
  timeline.forEach(e => {
    // Extract numbers from text if possible, or use data object if available
    // Simple heuristic for this demo:
    if (e.text.includes('SpO2')) {
      const val = parseInt(e.text.match(/SpO2 (\d+)/)?.[1]);
      if (val < 90) {
        dets.push({ type: val < 85 ? 'SEVERE_HYPOXIA' : 'HYPOXIA', value: val, timestamp: e.time, label: `Oxygen drop: ${val}%` });
      }
    }
    if (e.text.includes('SBP')) {
      const val = parseInt(e.text.match(/SBP (\d+)/)?.[1]);
      if (val < 90) {
        dets.push({ type: 'HYPOTENSION', value: val, timestamp: e.time, label: `Blood pressure drop: ${val} mmHg` });
      }
    }
    if (e.text.includes('pH')) {
      const val = parseFloat(e.text.match(/pH ([\d.]+)/)?.[1]);
      if (val < 7.30) {
        dets.push({ type: 'ACIDOSIS', value: val, timestamp: e.time, label: `Respiratory acidosis: pH ${val}` });
      }
    }
  });
  return dets;
}

function buildEventChains(deteriorations, timeline) {
  return deteriorations.map(det => {
    const window = 60 * 60 * 1000; // 60 mins
    const escalation = timeline.find(e => 
      e.time > det.timestamp && 
      e.time <= det.timestamp + window && 
      (e.type === 'ACTION' || e.type === 'TASK') &&
      isRelated(det.type, e.text)
    );

    return {
      deterioration: det,
      escalation: escalation || null,
      delayMinutes: escalation ? Math.round((escalation.time - det.timestamp) / 60000) : null,
      status: escalation ? ( (escalation.time - det.timestamp) <= window ? 'TIMELY' : 'DELAYED' ) : 'MISSING'
    };
  });
}

function isRelated(detType, actionText) {
  const text = actionText.toLowerCase();
  if (detType.includes('HYPOXIA') || detType === 'ACIDOSIS') {
    return text.includes('oxygen') || text.includes('ventilation') || text.includes('intubation') || text.includes('mask');
  }
  if (detType === 'HYPOTENSION') {
    return text.includes('fluids') || text.includes('bolus') || text.includes('vasopressor') || text.includes('noradrenaline');
  }
  return false;
}

function validateResponses(chains, timeline) {
  return chains.map(chain => {
    if (!chain.escalation) return { ...chain, response: { status: 'MISSING', improved: false } };

    const window = 120 * 60 * 1000; // 120 mins
    const postActionReading = timeline.find(e => 
      e.time > chain.escalation.time && 
      e.time <= chain.escalation.time + window && 
      e.text.includes(getTypeKey(chain.deterioration.type))
    );

    if (!postActionReading) return { ...chain, response: { status: 'DELAYED', improved: false } };

    const beforeVal = chain.deterioration.value;
    const afterVal = parseFloat(postActionReading.text.match(/[\d.]+/)?.[0]);
    
    let improved = false;
    if (chain.deterioration.type.includes('HYPOXIA')) improved = afterVal > beforeVal;
    if (chain.deterioration.type === 'ACIDOSIS') improved = afterVal > beforeVal;
    if (chain.deterioration.type === 'HYPOTENSION') improved = afterVal > beforeVal;

    return {
      ...chain,
      response: {
        improved,
        before: beforeVal,
        after: afterVal,
        delta: afterVal - beforeVal,
        status: improved ? 'ADEQUATE' : 'POOR',
        timestamp: postActionReading.time
      }
    };
  });
}

function getTypeKey(type) {
  if (type.includes('HYPOXIA')) return 'SpO2';
  if (type === 'HYPOTENSION') return 'SBP';
  if (type === 'ACIDOSIS') return 'pH';
  return '';
}

function calculateTelemetryStats(timeline) {
  if (timeline.length < 2) return { continuity: 'INSUFFICIENT', gaps: [], density: 0 };
  
  const gaps = [];
  const threshold = 2 * 60 * 60 * 1000; // 2h
  
  for (let i = 1; i < timeline.length; i++) {
    const diff = timeline[i].time - timeline[i-1].time;
    if (diff > threshold) {
      gaps.push({ from: timeline[i-1].time, to: timeline[i].time, durationMins: Math.round(diff / 60000) });
    }
  }

  const durationHrs = (timeline[timeline.length - 1].time - timeline[0].time) / (1000 * 60 * 60);
  const density = durationHrs > 0 ? (timeline.length / durationHrs).toFixed(1) : 0;

  return {
    continuity: gaps.length === 0 ? 'CONTINUOUS' : 'INTERRUPTED',
    gapCount: gaps.length,
    gaps,
    density: parseFloat(density)
  };
}

function computeBillingUnits(timeline, pt) {
  const units = [];
  
  // 1. ICU Stay
  const firstEvent = timeline[0];
  const lastEvent = timeline[timeline.length - 1];
  const totalHrs = (lastEvent.time - firstEvent.time) / (1000 * 60 * 60);
  const icuDays = Math.ceil(totalHrs / 24) || 1;
  units.push({ type: 'ICU_STAY', hours: totalHrs.toFixed(1), units: icuDays, code: 'ICU_DAILY' });

  // 2. Ventilator
  const ventStart = timeline.find(e => e.subtype === 'VENTILATION_FAILURE' || e.text.toLowerCase().includes('intubation') || e.text.toLowerCase().includes('ventilator on'));
  const ventEnd = [...timeline].reverse().find(e => e.subtype === 'PATIENT_EXTUBATED' || e.text.toLowerCase().includes('ventilator off'));
  
  if (ventStart && ventEnd && ventEnd.time > ventStart.time) {
    const vHrs = (ventEnd.time - ventStart.time) / (1000 * 60 * 60);
    const vSlab = vHrs <= 24 ? 1 : 2; // Simple slab mapping
    units.push({ type: 'VENTILATOR', hours: vHrs.toFixed(1), units: vSlab, code: vHrs <= 24 ? 'VENT_BASE' : 'VENT_EXTENDED' });
  }

  // 3. Procedures
  const procedures = timeline.filter(e => isProcedure(e.text));
  procedures.forEach(p => {
    units.push({ type: 'PROCEDURE', label: p.text, timestamp: p.time, code: 'PROC_GEN' });
  });

  return units;
}

function isProcedure(text) {
  const t = text.toLowerCase();
  return t.includes('intubation') || t.includes('cpr') || t.includes('central line') || t.includes('catheterization');
}

function generateBillingItems(billingUnits, chains) {
  return billingUnits.map(unit => {
    // Link chains as evidence
    const relatedChain = chains.find(c => 
      (unit.type === 'VENTILATOR' && (c.deterioration.type.includes('HYPOXIA') || c.deterioration.type === 'ACIDOSIS')) ||
      (unit.type === 'ICU_STAY' && c.status === 'TIMELY')
    );

    let strength = 'WEAK';
    if (relatedChain) {
      if (relatedChain.status === 'TIMELY' && relatedChain.response.status === 'ADEQUATE') strength = 'STRONG';
      else if (relatedChain.status !== 'MISSING') strength = 'MODERATE';
    }

    return {
      ...unit,
      strength,
      defense: {
        indication: relatedChain?.deterioration.label || "General Clinical Monitoring",
        intervention: relatedChain?.escalation?.text || unit.label || "Initiation of high-acuity care",
        response: relatedChain?.response.improved ? `Success: ${relatedChain.deterioration.type} resolved.` : "Continuous evaluation in progress."
      },
      evidence: {
        triggerValue: relatedChain?.deterioration.value,
        timestamp: unit.timestamp || relatedChain?.deterioration.timestamp,
        escalationStatus: relatedChain?.status || 'N/A'
      }
    };
  });
}

function calculateClaimScores(billingItems, telemetry, timeline) {
  let score = 100;
  
  // Deductions
  if (billingItems.some(i => i.strength === 'WEAK')) score -= 20;
  if (!timeline.every(e => e.time)) score -= 15;
  if (billingItems.some(i => i.evidence.escalationStatus === 'DELAYED')) score -= 15;
  if (billingItems.some(i => i.defense.response === 'Continuous evaluation in progress.')) score -= 15;
  if (telemetry.continuity === 'INTERRUPTED') score -= 15;

  // Confidence Score
  const densityFactor = Math.min(telemetry.density / 4, 1); // Goal 4 readings/hr
  const completenessFactor = billingItems.filter(i => i.strength === 'STRONG').length / (billingItems.length || 1);
  const confidence = Math.round(((densityFactor + completenessFactor) / 2) * 100);

  return { globalScore: Math.max(score, 0), confidenceScore: confidence };
}

function detectRisks(billingItems, chains, timeline) {
  const denialRisks = [];
  const revenueLeaks = [];

  // Overbilling Check
  const icuStay = billingItems.find(i => i.type === 'ICU_STAY');
  if (icuStay && !chains.some(c => c.status === 'TIMELY')) {
    denialRisks.push({ severity: 'HIGH', message: "ICU billing found without documented clinical instability/escalation." });
  }

  // Revenue Leak Check
  const critAlerts = timeline.filter(e => e.type === 'ALERT' && e.severity === 'Critical');
  critAlerts.forEach(a => {
    const action = timeline.find(e => e.time > a.time && e.time <= a.time + 3600000);
    if (action && !billingItems.some(i => i.type === 'PROCEDURE' && i.timestamp === action.time)) {
      revenueLeaks.push({ type: 'MISSED_PROCEDURE', message: `Emergency ${action.text} detected but not billed.` });
    }
  });

  return { denialRisks, revenueLeaks };
}

module.exports = { 
  generateBillingIntelligence,
  detectDeteriorations,
  buildEventChains,
  validateResponses,
  calculateTelemetryStats,
  computeBillingUnits,
  generateBillingItems,
  calculateClaimScores,
  detectRisks
};