const logger = require('../config/pinoLogger');

const SLA_RULES = {
  oxygen: 5 * 60 * 1000,
  iv_access: 5 * 60 * 1000,
  fluids: 10 * 60 * 1000,
  antibiotics: 60 * 60 * 1000,
  ecg: 10 * 60 * 1000,
  thrombolysis: 60 * 60 * 1000,
  intubation: 0
};

const getSlaDuration = (taskStr) => {
   const lower = taskStr.toLowerCase();
   if (lower.includes('oxygen')) return SLA_RULES.oxygen;
   if (lower.includes('iv access')) return SLA_RULES.iv_access;
   if (lower.includes('fluid')) return SLA_RULES.fluids;
   if (lower.includes('antibiotic')) return SLA_RULES.antibiotics;
   if (lower.includes('ecg')) return SLA_RULES.ecg;
   if (lower.includes('thrombolysis')) return SLA_RULES.thrombolysis;
   if (lower.includes('intubation')) return SLA_RULES.intubation;
   return 10 * 60 * 1000; 
};

const persistPatient = async (isRedisAvailable, redisClient, pt) => {
    if (isRedisAvailable && redisClient) {
        try {
            await redisClient.set(`patient:${pt.caseId}`, JSON.stringify(pt));
            if (pt.tasks) {
                await redisClient.set(`tasks:${pt.caseId}`, JSON.stringify(pt.tasks));
            }
        } catch (e) {
            logger.error(`Redis Set Error: ${e.message}`);
        }
    }
};

const persistAlert = async (isRedisAvailable, redisClient, alert) => {
    if (isRedisAvailable && redisClient && alert) {
        try {
            await redisClient.set(`alert:${alert.caseId}`, JSON.stringify(alert));
        } catch (e) { 
            logger.error(`Redis Alert Persist Error: ${e.message}`);
        }
    }
};

const persistAudit = async (isRedisAvailable, redisClient, caseId, logName, data) => {
    if (isRedisAvailable && redisClient) {
        try {
            await redisClient.rPush(`audit:${caseId}`, JSON.stringify({ logName, timestamp: Date.now(), data }));
        } catch (e) { 
            logger.error(`Redis Audit Persist Error: ${e.message}`);
        }
    }
};

const recordTiming = (isRedisAvailable, redisClient, category, valueMs) => {
    const hour = new Date().getHours();
    const shift = (hour >= 8 && hour < 20) ? 'Day' : 'Night';
    
    if (isRedisAvailable && redisClient) {
        redisClient.hIncrBy('metrics:timing', `total${category}Ms`, valueMs).catch(()=>{});
        redisClient.hIncrBy('metrics:timing', `total${category}Ms_${shift}`, valueMs).catch(()=>{});
        
        const countKey = category === 'Ack' ? 'ackCount' : category === 'Action' ? 'actionCount' : 'CompletionCount';
        redisClient.hIncrBy('metrics:timing', countKey, 1).catch(()=>{});
        redisClient.hIncrBy('metrics:timing', `${countKey}_${shift}`, 1).catch(()=>{});
    }
};

const incrementOutcome = (isRedisAvailable, redisClient, field, icuOutcomesMem) => {
    if (isRedisAvailable && redisClient) {
        redisClient.hIncrBy('metrics:icu_outcomes', field, 1).catch(err => logger.error(`Outcomes HINCRBY Error: ${err.message}`));
    } else {
        if (icuOutcomesMem[field] === undefined) icuOutcomesMem[field] = 0;
        icuOutcomesMem[field]++;
    }
};

const incrementMetric = (isRedisAvailable, redisClient, field, systemMetricsMem) => {
    const hour = new Date().getHours();
    const shift = (hour >= 8 && hour < 20) ? 'Day' : 'Night';
    
    if (isRedisAvailable && redisClient) {
        redisClient.hIncrBy('metrics:global', field, 1).catch(err => logger.error(`Metrics HINCRBY Error: ${err.message}`));
        if (field === 'overdueTasks') redisClient.hIncrBy('metrics:global', `${field}_${shift}`, 1).catch(()=>{});
    } else {
        if (systemMetricsMem[field] === undefined) systemMetricsMem[field] = 0;
        systemMetricsMem[field]++;
        if (field === 'overdueTasks') {
            const shiftField = `${field}_${shift}`;
            if (systemMetricsMem[shiftField] === undefined) systemMetricsMem[shiftField] = 0;
            systemMetricsMem[shiftField]++;
        }
    }
};

module.exports = {
    getSlaDuration,
    persistPatient,
    persistAlert,
    persistAudit,
    recordTiming,
    incrementOutcome,
    incrementMetric,
    SLA_RULES
};
