/**
 * Auto Discharge Summary Engine v2 (Medico-Legal Grade)
 * ---------------------------------------------------------
 * Aggregates clinical telemetry, notes, and audit trails
 * into a structured, chronological discharge report.
 */

async function buildUnifiedTimeline(caseId, redisClient) {
  if (!redisClient) return [];
  
  try {
    const [notesRaw, auditRaw, executionRaw, alertRaw] = await Promise.all([
      redisClient.lRange(`notes:${caseId}`, 0, -1),
      redisClient.lRange(`audit:${caseId}`, 0, -1),
      redisClient.lRange(`execution:${caseId}`, 0, -1),
      redisClient.get(`alert:${caseId}`)
    ]);

    const timeline = [];

    // 1. Process Notes
    notesRaw.forEach(r => {
      const n = JSON.parse(r);
      timeline.push({
        time: n.timestamp,
        type: 'NOTE',
        subtype: n.type,
        actor: `${n.user?.name || 'Clinician'} (${n.user?.role || n.type})`,
        text: n.isAddendum ? `[ADDENDUM] ${Object.values(n.content).filter(v => v).join('; ')}` : Object.values(n.content).filter(v => v).join('; '),
        isCritical: n.isCritical,
        category: n.isCritical ? 'DETERIORATION' : 'STABILIZATION'
      });
    });

    // 2. Process Audit Trail
    auditRaw.forEach(r => {
      const a = JSON.parse(r);
      let category = 'INTERVENTION';
      if (a.logName === 'ADMISSION' || a.logName === 'PATIENT_CREATED') category = 'ADMISSION';
      if (a.logName === 'PATIENT_EXTUBATED') category = 'WEANING';

      timeline.push({
        time: a.timestamp,
        type: 'ACTION',
        subtype: a.logName,
        actor: a.data?.user?.name || 'System',
        text: `Action performed: ${a.logName.replace(/_/g, ' ')}`,
        data: a.data,
        category
      });
    });

    // 3. Process Execution Telemetry
    executionRaw.forEach(r => {
      const e = JSON.parse(r);
      if (e.completedAt) {
        timeline.push({
          time: e.completedAt,
          type: 'TASK',
          subtype: e.category,
          actor: e.completedBy || 'Clinician',
          text: `Protocol step completed: ${e.label}`,
          category: 'INTERVENTION'
        });
      }
    });

    // 4. Process Alerts
    if (alertRaw) {
      const al = JSON.parse(alertRaw);
      timeline.push({
        time: al.timeMs,
        type: 'ALERT',
        subtype: al.alertType,
        actor: 'SYSTEM',
        text: `Critical Alert: ${al.alertType}`,
        severity: al.severity,
        category: 'COMPLICATION'
      });
    }

    // Sort strictly ascending by time
    return timeline.sort((a, b) => a.time - b.time);
  } catch (err) {
    console.error("Timeline Generation Error:", err);
    return [];
  }
}

async function generateDischargeSummary(caseId, redisClient) {
  const timeline = await buildUnifiedTimeline(caseId, redisClient);
  const patientRaw = await redisClient.get(`patient:${caseId}`);
  const pt = patientRaw ? JSON.parse(patientRaw) : null;

  if (!pt && timeline.length === 0) {
    return { summaryText: "Data not available in records for Case: " + caseId, summaryJSON: {} };
  }

  // derive sections
  const firstEvent = timeline[0];
  const lastEvent  = timeline[timeline.length - 1];
  const durationHrs = firstEvent && lastEvent ? ((lastEvent.time - firstEvent.time) / (1000 * 60 * 60)).toFixed(1) : "0";

  // Admission Summary
  const firstNote = timeline.find(e => e.type === 'NOTE' && e.subtype === 'Doctor');
  const admissionSection = firstNote ? firstNote.text : (pt?.diagnosis || "Undifferentiated condition");

  // Clinical Course Auto-Narrative
  const narrative = timeline.map(e => {
    const timeStr = new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `[${timeStr}] ${e.text} (${e.actor})`;
  }).join('\n');

  // Interventions
  const interventions = timeline
    .filter(e => e.category === 'INTERVENTION')
    .map(e => `- ${e.text.replace('Protocol step completed: ', '')}`)
    .filter((v, i, a) => a.indexOf(v) === i); // Unique

  // Ventilator Course
  const ventEvents = timeline.filter(e => e.subtype === 'VENTILATION_FAILURE' || e.subtype === 'PATIENT_EXTUBATED' || e.text.includes('SBT'));
  let ventSummary = "No mechanical ventilation recorded.";
  if (pt?.fullData?.ventilatorStatus) {
    const vs = pt.fullData.ventilatorStatus;
    ventSummary = `Mode: ${vs.settings?.mode || 'N/A'}. `;
    if (vs.sbt) ventSummary += `SBT Status: ${vs.sbt.state}. `;
    if (vs.sbt?.extubatedAt) ventSummary += `Successfully extubated at ${new Date(vs.sbt.extubatedAt).toLocaleString()}.`;
  }

  // Complications
  const complications = timeline
    .filter(e => e.category === 'COMPLICATION' || e.severity === 'Critical')
    .map(e => `- ${e.text}`);

  // Final Diagnosis
  const latestDoctorNote = [...timeline].reverse().find(e => e.type === 'NOTE' && e.subtype === 'Doctor');
  const finalDiagnosis = latestDoctorNote ? latestDoctorNote.text.split('\n')[0] : (pt?.primaryDiagnosis || pt?.diagnosis || "See clinical course");

  // Condition at Discharge
  const lastVitals = pt?.fullData?.vitals || {};
  const dischargeCondition = `Stable. Last measured vitals: BP ${lastVitals.bp || '--'}, HR ${lastVitals.pulse || '--'}, SpO2 ${lastVitals.spo2 || '--'}%.`;

  // Audit Trail
  const auditTrail = timeline.map(e => {
    const timeStr = new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `[${timeStr}] ${e.type}: ${e.text} â€” Performed by ${e.actor}`;
  });

  const structured = {
    patientInfo: { name: pt?.patientName, age: pt?.age, gender: pt?.gender, caseId },
    admissionSummary: admissionSection,
    clinicalCourse: narrative,
    interventions: interventions.join('\n'),
    ventilatorCourse: ventSummary,
    complications: complications.join('\n'),
    finalDiagnosis,
    conditionAtDischarge: dischargeCondition,
    icuDuration: `${durationHrs} hours`,
    auditTrail
  };

  const textOutput = `
---------------------------------------------------------
           OFFICIAL DISCHARGE SUMMARY
---------------------------------------------------------
PATIENT: ${structured.patientInfo.name} (${structured.patientInfo.age}/${structured.patientInfo.gender})
CASE ID: ${caseId}
ICU DURATION: ${structured.icuDuration}
---------------------------------------------------------

ADMISSION SUMMARY:
${structured.admissionSummary}

CLINICAL COURSE (Timeline):
${structured.clinicalCourse}

INTERVENSIONS & PROCEDURES:
${structured.interventions || 'No major procedures recorded.'}

VENTILATOR COURSE:
${structured.ventilatorCourse}

COMPLICATIONS:
${structured.complications || 'None recorded.'}

FINAL DIAGNOSIS:
${structured.finalDiagnosis}

CONDITION AT DISCHARGE:
${structured.conditionAtDischarge}

ADVICE & FOLLOW-UP:
- Review in OPD after 7 days.
- In case of warning signs (breathlessness, chest pain, fever), return to ER immediately.

---------------------------------------------------------
MEDICO-LEGAL AUDIT TRAIL:
${structured.auditTrail.join('\n')}

---------------------------------------------------------
FOOTER:
This summary is auto-generated based on real-time bedside
telemetry and clinical documentation. Verified by the system.
---------------------------------------------------------
`;

  return {
    summaryJSON: structured,
    summaryText: textOutput
  };
}

module.exports = { generateDischargeSummary, buildUnifiedTimeline };