const logger = require('../config/pinoLogger');
const { persistAlert, persistPatient, persistAudit, incrementMetric } = require('./socketUtils');

module.exports = (io, state) => {
  const { activeAlerts, activePatients, alertCooldowns, isRedisAvailable, redisClient, systemMetricsMem } = state;

  const dispatchAlert = (targetRooms, alertPayload) => {
    const alertSignature = `${alertPayload.caseId}:${alertPayload.alertType}`;
    const severityLevels = { 'Stable': 0, 'Standard': 1, 'Moderate': 2, 'Critical': 3, 'CRITICAL_CONFLICT': 4 };
    const currentSev = severityLevels[alertPayload.severity] || 0;

    if (alertCooldowns.has(alertSignature)) {
       const last = alertCooldowns.get(alertSignature);
       const lastSev = severityLevels[last.severity] || 0;
       
       if (currentSev <= lastSev && (Date.now() - last.timestamp < 60000)) {
          io.emit("suppressed_alert", { caseId: alertPayload.caseId, alertType: alertPayload.alertType });
          return;
       }
    }
    alertCooldowns.set(alertSignature, { timestamp: Date.now(), severity: alertPayload.severity });

    const enrichedAlert = {
       ...alertPayload,
       timeMs: Date.now(),
       acknowledged: false,
       acknowledgedBy: null,
       acknowledgedAt: null,
       actions: []
    };

    activeAlerts.set(enrichedAlert.caseId, enrichedAlert);
    persistAlert(isRedisAvailable, redisClient, enrichedAlert);
    incrementMetric(isRedisAvailable, redisClient, 'totalAlerts', systemMetricsMem);
    logger.info(`Alert emitted: ${enrichedAlert.caseId} - ${enrichedAlert.alertType}`);
    
    // Broadcast to facility room and specific role rooms
    const facilityRoom = `facility:${alertPayload.facilityId || 'global'}`;
    targetRooms.forEach(room => io.to(room).to(facilityRoom).emit('critical_alert', enrichedAlert));
    
    // Escalation Logic
    let escLevel = 1;
    const scheduleEscalation = (delayMs) => {
       setTimeout(() => {
          const currentAlert = activeAlerts.get(alertPayload.caseId);
          if (currentAlert && !currentAlert.acknowledged && escLevel <= 3) {
             currentAlert.escalated = true;
             currentAlert.escalationLevel = escLevel;
             activeAlerts.set(alertPayload.caseId, currentAlert);
             persistAlert(isRedisAvailable, redisClient, currentAlert);
             io.to('CONSULTANT').emit('critical_alert', currentAlert);
             logger.warn(`ALERT ${alertPayload.caseId} ESCALATED (Level ${escLevel})`);
             incrementMetric(isRedisAvailable, redisClient, 'escalations', systemMetricsMem);
             persistAudit(isRedisAvailable, redisClient, alertPayload.caseId, 'ESCALATION', { escLevel });
             escLevel++;
             scheduleEscalation(escLevel === 2 ? 60000 : 120000);
          }
       }, delayMs);
    };
    scheduleEscalation(30000);
  };

  const updateActivePatient = (patientData) => {
    activePatients.set(patientData.caseId, patientData);
    persistPatient(isRedisAvailable, redisClient, patientData);
    
    const facilityRoom = `facility:${patientData.facilityId || 'global'}`;
    io.to(facilityRoom).to('CONSULTANT').to('ADMIN').emit('patient_updated', patientData);
  };

  return { dispatchAlert, updateActivePatient };
};
