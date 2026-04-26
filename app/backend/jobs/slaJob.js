const logger = require('../config/pinoLogger');
const { incrementMetric } = require('../socket/socketUtils');

const slaMonitorJob = (io, state) => {
   const { activePatients, activeAlerts, isRedisAvailable, redisClient, systemMetricsMem } = state;
   const now = Date.now();
   const snapshot = [];
   
   for (const [caseId, pt] of activePatients.entries()) {
      if (now - pt.lastUpdated > 86400000) {
         activePatients.delete(caseId);
         if (isRedisAvailable && redisClient) {
            redisClient.del(`patient:${caseId}`).catch(()=>{});
            redisClient.del(`tasks:${caseId}`).catch(()=>{});
            redisClient.del(`alert:${caseId}`).catch(()=>{});
         }
         continue;
      }
      
      const alert = activeAlerts.get(caseId);
      pt.alertsActive = alert ? (!alert.acknowledged || alert.escalated || alert.noActionTaken) : false;
      
      const ALERT_SLA = 120000; // 2 minutes
      
      activeAlerts.forEach(alert => {
         if (!alert.acknowledged || alert.actions.length === 0) {
            const elapsed = now - alert.timeMs;
            if (elapsed > ALERT_SLA * 0.7 && elapsed <= ALERT_SLA && !alert.atRisk) {
               alert.atRisk = true;
               io.to('CONSULTANT').emit('delay_warning', { type: 'alert', caseId: alert.caseId, status: 'At Risk', patientName: alert.patientName });
               activeAlerts.set(alert.caseId, alert);
            }
         }
      });
      
      let priorityScore = 0;
      if (pt.severity === "Critical" || pt.triageLevel === "RED") priorityScore += 100;
      if (pt.alertsActive || activeAlerts.has(pt.caseId)) priorityScore += 50;
      if (pt.location === "ICU") priorityScore += 40;
      
      if (pt.tasks) {
         pt.tasks.forEach(t => {
            if (t.status === 'pending') {
               const totalSla = t.dueBy - t.createdAt;
               const diff = t.dueBy - now;
               const elapsed = now - t.createdAt;
               
               if (diff < 120000 && diff > 0) priorityScore += 80;
               if (elapsed > totalSla * 0.7 && elapsed <= totalSla && !t.atRisk) {
                  t.atRisk = true;
                  priorityScore += 60;
                  io.to('CONSULTANT').emit('delay_warning', { type: 'task', caseId: pt.caseId, task: t.task, status: 'At Risk', patientName: pt.patientName });
               } else if (t.atRisk) {
                  priorityScore += 60;
               }
               
               if (diff <= 0) priorityScore += 120;
               
               if (now > t.dueBy && !t.escalated) {
                  t.escalated = true;
                  t.escalationLevel = 1;
                  incrementMetric(isRedisAvailable, redisClient, 'overdueTasks', systemMetricsMem);
                  logger.warn(`SLA Breach: ${t.task} overdue on ${pt.caseId}`);
                  
                  // Bottleneck detection
                  const bottleneckMem = global.bottleneckMem || (global.bottleneckMem = {});
                  bottleneckMem[t.task] = (bottleneckMem[t.task] || 0) + 1;
                  if (bottleneckMem[t.task] > 1 && bottleneckMem[t.task] % 2 === 0) {
                      logger.warn(`System bottleneck detected in [${t.task}]`);
                      io.emit('critical_alert', {
                         caseId: 'SYSTEM',
                         patientName: 'ICU Analytics Engine',
                         alertType: `⚠ SYSTEM BOTTLENECK DETECTED`,
                         severity: 'Critical',
                         timestamp: new Date().toLocaleTimeString(),
                         fullData: { 
                             reason: `System bottleneck detected in [${t.task}]`,
                             occurrences: bottleneckMem[t.task] 
                         }
                      });
                  }

                  io.to('CONSULTANT').emit('critical_alert', {
                     caseId: pt.caseId,
                     patientName: pt.patientName,
                     alertType: `TASK OVERDUE: ${t.task}`,
                     severity: 'Critical',
                     timestamp: new Date().toLocaleTimeString(),
                     fullData: pt.fullData
                  });
               }
            }
         });
      }
      
      snapshot.push(pt);
   }
   
   io.emit("patient_snapshot", snapshot);
};

module.exports = { slaMonitorJob };
