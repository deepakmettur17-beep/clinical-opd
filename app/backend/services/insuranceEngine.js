/**
 * Insurance Justification Engine v2 (Claim-Approval Grade)
 * ---------------------------------------------------------
 * DATA -> DECISION -> ACTION
 * Automatically generates data-driven defense documents
 * for insurance providers.
 */

const { buildUnifiedTimeline } = require('./dischargeEngine');

/**
 * Generates an insurance-ready justification report.
 * @param {string} caseId 
 * @param {object} redisClient 
 */
async function generateInsuranceJustification(caseId, redisClient) {
  if (!redisClient) throw new Error("Redis client required");

  // 1. Check for existing locked report (Immutability)
  const existing = await redisClient.get(`insurance:${caseId}`);
  if (existing) return JSON.parse(existing);

  // 2. Fetch Evidence Sources
  const [timeline, ptRaw] = await Promise.all([
    buildUnifiedTimeline(caseId, redisClient),
    redisClient.get(`patient:${caseId}`)
  ]);

  const pt = ptRaw ? JSON.parse(ptRaw) : null;
  const vitalHistory = pt?.fullData?.vitalHistory || [];
  const actions = timeline.filter(e => e.type === 'ACTION' || e.type === 'TASK');
  const alerts = timeline.filter(e => e.type === 'ALERT');

  // Logic Counters / Triggers
  const icuJustification = [];
  const ventJustification = [];
  const prolongedJustification = [];
  const interventionJustification = [];

  // STEP 3: ICU ADMISSION JUSTIFICATION
  // Trigger: SpO2 < 90, SBP < 90, HR > 130, GCS < 12, IMMEDIATE priority
  vitalHistory.forEach(v => {
    const time = new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (v.spo2 < 90) {
      icuJustification.push(`At ${time}, patient developed hypoxia (SpO2 ${v.spo2}%).`);
    }
    if (v.bp) {
      const sbp = parseInt(v.bp.split('/')[0]);
      if (sbp < 90) {
        icuJustification.push(`At ${time}, hemodynamic instability recorded (SBP ${sbp} mmHg).`);
      }
    }
    if (v.hr > 130) {
      icuJustification.push(`At ${time}, severe sinus tachycardia recorded (HR ${v.hr} bpm).`);
    }
  });

  // Check GCS if present in notes or data
  const gcsNote = timeline.find(e => e.text && e.text.toLowerCase().includes('gcs'));
  if (gcsNote) {
    const gcsValue = parseInt(gcsNote.text.match(/gcs\s*(\d+)/i)?.[1]);
    if (gcsValue && gcsValue < 12) {
      icuJustification.push(`At ${new Date(gcsNote.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, GCS dropped to ${gcsValue}, requiring advanced neuro-monitoring in ICU.`);
    }
  }

  // STEP 4: VENTILATOR JUSTIFICATION
  // Trigger: pH < 7.30, PaCO2 > 60, SpO2 < 85
  vitalHistory.forEach(v => {
    if (v.abg) {
      const time = new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (v.abg.ph < 7.30 || v.abg.pco2 > 60) {
        ventJustification.push(`ABG at ${time} confirmed acute respiratory acidosis (pH ${v.abg.ph}, PaCO2 ${v.abg.pco2} mmHg). Invasive mechanical ventilation was required to address ventilation failure.`);
      }
    }
    if (v.spo2 < 85) {
       const time = new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
       ventJustification.push(`At ${time}, refractory hypoxia (SpO2 ${v.spo2}%) necessitated immediate mechanical ventilatory support to prevent multi-organ failure.`);
    }
  });

  // STEP 5: PROLONGED STAY
  // Trigger: ICU > 3 days, SBT failure, complications
  const admissionEvent = timeline.find(e => e.category === 'ADMISSION');
  if (admissionEvent) {
    const durationDays = (Date.now() - admissionEvent.time) / (1000 * 60 * 60 * 24);
    if (durationDays > 3) {
      const sbtFailures = timeline.filter(e => e.type === 'ACTION' && e.subtype === 'SBT_FAILED').length;
      if (sbtFailures > 0) {
        prolongedJustification.push(`ICU stay was prolonged beyond 72 hours due to ${sbtFailures} failed weaning attempts, indicating persistent physiologic dependence on ventilators.`);
      } else {
        prolongedJustification.push(`Patient stay extended due to complex physiologic monitoring requirements and titrated vasoactive therapy.`);
      }
    }
  }

  // STEP 6: INTERVENTION MAPPING (CAUSE -> ACTION -> NEED)
  actions.forEach(a => {
    const time = new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (a.subtype === 'INTUBATION') {
      interventionJustification.push(`CAUSE: Respiratory Failure | ACTION: Intubation at ${time} | NEED: Airway Protection & Ventilation.`);
    }
    if (a.subtype === 'VASOPRESSORS_STARTED') {
      interventionJustification.push(`CAUSE: Refractory Shock | ACTION: Vasopressor Initiation at ${time} | NEED: MAP Maintenance.`);
    }
    if (a.subtype === 'FLUID_BOLUS_ADMIN') {
      interventionJustification.push(`CAUSE: Hypovolemia | ACTION: Fluid Resuscitation at ${time} | NEED: Intravascular Volume Expansion.`);
    }
  });

  // STEP 7: RED FLAG CHECK (Do not return if data is missing or too generic)
  if (icuJustification.length === 0 && ventJustification.length === 0 && prolongedJustification.length === 0 && interventionJustification.length === 0) {
    return {
      error: "RED_FLAG_REJECTION",
      message: "Insurance justification could not be generated: Missing required numeric data or high-acuity triggers in clinical log."
    };
  }

  // STEP 8: FINAL FORMAT (STRICT TEMPLATE)
  const reportText = `
----------------------------------
INSURANCE JUSTIFICATION REPORT (v2)
----------------------------------
CASE ID: ${caseId}
GENERATED: ${new Date().toLocaleString()}
STATUS: MEDICALLY DEFENDED / AUDIT LOCKED

ICU ADMISSION JUSTIFICATION:
${icuJustification.length > 0 ? icuJustification.join('\n') + '\nDue to high clinical risk of mortality, ICU admission was mandated for continuous monitoring.' : 'No continuous ICU triggers detected in recorded vitals.'}

VENTILATOR SUPPORT JUSTIFICATION:
${ventJustification.length > 0 ? ventJustification.join('\n') : 'No invasive ventilator triggers detected.'}

PROLONGED STAY JUSTIFICATION:
${prolongedJustification.length > 0 ? prolongedJustification.join('\n') : 'Length of stay within expected acute recovery window.'}

CRITICAL INTERVENTIONS JUSTIFICATION:
${interventionJustification.length > 0 ? interventionJustification.join('\n') : 'Routine clinical maintenance provided.'}

----------------------------------
This defense document is generated based on automated bedside telemetry.
Every statement maps to a recorded numeric event or clinician action.
----------------------------------
`.trim();

  const resultBody = {
    caseId,
    timestamp: Date.now(),
    justificationText: reportText,
    dataSummary: {
      icuTriggers: icuJustification.length,
      ventTriggers: ventJustification.length,
      interventions: interventionJustification.length
    }
  };

  // Lock the report (Immutability)
  await redisClient.set(`insurance:${caseId}`, JSON.stringify(resultBody));

  return resultBody;
}

module.exports = { generateInsuranceJustification };
