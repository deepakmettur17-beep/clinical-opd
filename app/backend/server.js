const express = require("express");
const mongoose = require("mongoose");
const http = require('http');
const { Server } = require("socket.io");
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { randomUUID } = require('crypto');
const cors = require('cors');
const path = require('path');
const connectDB = require('./db');
require("dotenv").config();

// Connect to Database
connectDB();

// Import Routes
const patientRoutes = require('./routes/patientRoutes');
const visitRoutes = require('./routes/visitRoutes');
const aiRoutes = require('./routes/aiRoutes');
const clinicalRoutes = require('./routes/clinicalRoutes');

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

const { processClinicalCase, calculateVentilatorSettings, calculateVentilatorResponse } = require("./services/clinicalOrchestrator");
const { runClinicalPathwayEngine } = require("./services/clinicalPathwayEngine");
const executionEngine = require("./services/clinicalExecutionEngine");
const { runComplianceAnalysis, completeStep, initPathwayLog, getExecutionLog } = executionEngine;
const { runResourceAllocation } = require('./services/resourceAllocationEngine');
const { SmartClinicalSuggestionEngine } = require('./services/clinicalSuggestionEngine');
const { addClinicalNote, getClinicalNotes } = require('./services/notesService');
const { generateDischargeSummary } = require('./services/dischargeEngine');
const { generateInsuranceJustification } = require('./services/insuranceEngine');
const { generateVerifiablePDF, verifyPDF } = require('./services/pdfEngine');
const { generateBillingIntelligence } = require('./services/billingEngine');
const { runClaimAutoFixEngine, runClaimGuard } = require('./services/ClaimAutoFixEngine');
const { runHospitalOS } = require("./services/hospitalOrchestrator");
const { generatePatientMessage } = require("./services/quickExplain");
const { runTriageEngine } = require("./services/triageEngine");
const clinicalExecutionLogs = new Map(); // caseId -> in-memory fallback
const lastActionAtMap      = new Map(); // caseId -> timestamp of last completed step

const app = express();
const corsOptions = {
  origin: '*',
  methods: ["GET", "POST"],
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount Routes
app.use('/patients', patientRoutes);
app.use('/visits', visitRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', clinicalRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'clinical-opd-backend', status: 'live' });
});

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

// --- SYSTEM OBSERVABILITY & METRICS ---
const systemMetricsMem = {
    totalAlerts: 0,
    escalations: 0,
    overdueTasks: 0
};

const logger = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
    error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`)
};

const incrementMetric = (field) => {
    const hour = new Date().getHours();
    const shift = (hour >= 8 && hour < 20) ? 'Day' : 'Night';
    
    if (typeof isRedisAvailable !== 'undefined' && isRedisAvailable && redisClient) {
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

const recordTiming = (category, valueMs) => {
    const hour = new Date().getHours();
    const shift = (hour >= 8 && hour < 20) ? 'Day' : 'Night';
    
    if (typeof isRedisAvailable !== 'undefined' && isRedisAvailable && redisClient) {
        redisClient.hIncrBy('metrics:timing', `total${category}Ms`, valueMs).catch(()=>{});
        redisClient.hIncrBy('metrics:timing', `total${category}Ms_${shift}`, valueMs).catch(()=>{});
        
        const countKey = category === 'Ack' ? 'ackCount' : category === 'Action' ? 'actionCount' : 'CompletionCount';
        redisClient.hIncrBy('metrics:timing', countKey, 1).catch(()=>{});
        redisClient.hIncrBy('metrics:timing', `${countKey}_${shift}`, 1).catch(()=>{});
    }
};

const icuOutcomesMem = {
    totalSBTAttempts: 0, sbtFailures: 0, extubations: 0, extubationFailures: 0
};

const incrementOutcome = (field) => {
    if (typeof isRedisAvailable !== 'undefined' && isRedisAvailable && redisClient) {
        redisClient.hIncrBy('metrics:icu_outcomes', field, 1).catch(err => logger.error(`Outcomes HINCRBY Error: ${err.message}`));
    } else {
        if (icuOutcomesMem[field] === undefined) icuOutcomesMem[field] = 0;
        icuOutcomesMem[field]++;
    }
};

// Moved to bottom for middleware consistency

const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    const token = authHeader.split(' ')[1];
    if (typeof isRedisAvailable !== 'undefined' && isRedisAvailable && redisClient) {
        const data = await redisClient.get(`session:${token}`);
        if (!data) return res.status(401).json({ error: "Invalid token" });
        req.user = JSON.parse(data);
        next();
    } else {
        next();
    }
};

app.get('/api/system/metrics', requireAuth, async (req, res) => {
    let metrics = { ...systemMetricsMem };
    let timings = { avgAckSec: 0, avgActionSec: 0, slaBreachPerc: 0 };
    if (typeof isRedisAvailable !== 'undefined' && isRedisAvailable && redisClient) {
        try {
            const redisMetrics = await redisClient.hGetAll('metrics:global');
            if (redisMetrics && Object.keys(redisMetrics).length > 0) {
                metrics.totalAlerts = parseInt(redisMetrics.totalAlerts || 0);
                metrics.escalations = parseInt(redisMetrics.escalations || 0);
                metrics.overdueTasks = parseInt(redisMetrics.overdueTasks || 0);
            }
            
            const rawTiming = await redisClient.hGetAll('metrics:timing');
            if (rawTiming) {
               const ackMs = parseInt(rawTiming.totalAckMs || 0);
               const ackCount = parseInt(rawTiming.ackCount || 0);
               if (ackCount > 0) timings.avgAckSec = (ackMs / ackCount / 1000).toFixed(1);
               
               const actMs = parseInt(rawTiming.totalActionMs || 0);
               const actCount = parseInt(rawTiming.actionCount || 0);
               if (actCount > 0) timings.avgActionSec = (actMs / actCount / 1000).toFixed(1);
               
               const comps = parseInt(rawTiming.CompletionCount || 0);
               if (comps > 0) timings.slaBreachPerc = ((metrics.overdueTasks / comps) * 100).toFixed(1);
            }
        } catch (err) {
            logger.error(`Metrics Read Error: ${err.message}`);
        }
    }
    res.json({
        ...metrics,
        ...timings,
        activePatients: activePatients ? activePatients.size : 0,
        activeAlerts: activeAlerts ? activeAlerts.size : 0
    });
});

app.post('/api/quick-explain', (req, res) => {
    const { reportText, patientName } = req.body;
    const message = generatePatientMessage(reportText, patientName);
    res.json({ message });
});

app.get('/api/system/icu-analytics', requireAuth, async (req, res) => {
    let raw = { ...icuOutcomesMem };
    let metrics = { ...systemMetricsMem };
    let timings = { avgAckSec: 0, avgActionSec: 0, slaBreachPerc: 0 };
    let shifts = {
        day: { slaCompliance: 100, avgResponseTime: 0 },
        night: { slaCompliance: 100, avgResponseTime: 0 }
    };
    
    if (typeof isRedisAvailable !== 'undefined' && isRedisAvailable && redisClient) {
        try {
            const redisOutcomes = await redisClient.hGetAll('metrics:icu_outcomes');
            if (redisOutcomes) Object.assign(raw, redisOutcomes);
            
            const redisMetrics = await redisClient.hGetAll('metrics:global');
            if (redisMetrics) Object.assign(metrics, redisMetrics);
            
            const rawTiming = await redisClient.hGetAll('metrics:timing');
            if (rawTiming) {
               const actMs = parseInt(rawTiming.totalActionMs || 0);
               const actCount = parseInt(rawTiming.actionCount || 0);
               if (actCount > 0) timings.avgActionSec = (actMs / actCount / 1000).toFixed(1);
               const comps = parseInt(rawTiming.CompletionCount || 0);
               if (comps > 0) timings.slaBreachPerc = ((parseInt(metrics.overdueTasks) || 0) / comps) * 100;
               
               const aMsDay = parseInt(rawTiming.totalActionMs_Day || 0);
               const aCntDay = parseInt(rawTiming.actionCount_Day || 0);
               if (aCntDay > 0) shifts.day.avgResponseTime = (aMsDay / aCntDay / 1000).toFixed(1);
               const cDay = parseInt(rawTiming.CompletionCount_Day || 0);
               const oDay = parseInt(metrics.overdueTasks_Day || 0);
               if (cDay > 0) shifts.day.slaCompliance = (100 - (oDay / cDay) * 100).toFixed(1);

               const aMsNight = parseInt(rawTiming.totalActionMs_Night || 0);
               const aCntNight = parseInt(rawTiming.actionCount_Night || 0);
               if (aCntNight > 0) shifts.night.avgResponseTime = (aMsNight / aCntNight / 1000).toFixed(1);
               const cNight = parseInt(rawTiming.CompletionCount_Night || 0);
               const oNight = parseInt(metrics.overdueTasks_Night || 0);
               if (cNight > 0) shifts.night.slaCompliance = (100 - (oNight / cNight) * 100).toFixed(1);
            }
        } catch (err) {
            logger.error(`ICU Analytics Read Error: ${err.message}`);
        }
    }
    
    const attempts = parseInt(raw.totalSBTAttempts) || 0;
    const sFailures = parseInt(raw.sbtFailures) || 0;
    const extubations = parseInt(raw.extubations) || 0;
    const extFailures = parseInt(raw.extubationFailures) || 0;
    
    const sbtSuccessRate = attempts > 0 ? (((attempts - sFailures) / attempts) * 100).toFixed(1) : 0;
    const extubationFailureRate = extubations > 0 ? ((extFailures / extubations) * 100).toFixed(1) : 0;
    const slaCompliance = (100 - (parseFloat(timings.slaBreachPerc) || 0)).toFixed(1);
    
    let alerts = [];
    if (parseFloat(extubationFailureRate) > 15) {
        alerts.push({ msg: "âš ï¸ High extubation failure rate â€” review weaning protocol", type: "warning" });
    }
    
    res.json({
        sbtSuccessRate,
        extubationFailureRate,
        avgResponseTime: timings.avgActionSec,
        slaCompliance,
        alerts,
        shifts,
        raw
    });
});

// --- TRIAGE BROADCAST ENGINE ---
const broadcastTriage = async () => {
   const patients = [];
   const rClient = isRedisAvailable && redisClient ? redisClient : null;

   for (const [caseId, pt] of activePatients.entries()) {
      const intel = pt.fullData?.ventilatorStatus?.predictiveIntel || {};
      const compliance = await runComplianceAnalysis(caseId, rClient, clinicalExecutionLogs.get(caseId));
      
      patients.push({
         caseId,
         patientName:      pt.patientName,
         diagnosis:        pt.primaryDiagnosis || pt.diagnosis,
         ward:             pt.ward || 'ICU',
         predictiveRisk:   intel.predictedRisk || 'LOW',
         riskScore:        intel.riskScore || 0,
         priorityLevel:    intel.actionPriority?.priorityLevel || 'ROUTINE',
         complianceScore:  compliance?.complianceScore ?? 100,
         missedImmediateCount: compliance?.missedSteps?.filter(s => s.category === 'IMMEDIATE').length || 0,
         lastActionAt:     lastActionAtMap.get(caseId) || null,
      });
   }

   const triageList = runTriageEngine(patients);
   io.to('CONSULTANT').to('ADMIN').emit('triage_update', triageList);
   return triageList;
};

// Auto-update triage every 30 seconds
setInterval(broadcastTriage, 30000);

// Auto-update resource allocation every 10 seconds
setInterval(async () => {
   const rClient = isRedisAvailable && redisClient ? redisClient : null;
   const enrichedPatients = [];
   
   for (const [caseId, pt] of activePatients.entries()) {
      const compliance = await runComplianceAnalysis(caseId, rClient, clinicalExecutionLogs.get(caseId));
      enrichedPatients.push({
         ...pt,
         triageScore: pt.triageScore || 0, // Fallback
         missedImmediateCount: compliance?.missedSteps?.filter(s => s.category === 'IMMEDIATE').length || 0,
         lastActionAt: lastActionAtMap.get(caseId) || null
      });
   }

   const triageEnriched = runTriageEngine(enrichedPatients); // Enrich with triage scores
   const data = runResourceAllocation(triageEnriched);
   io.to("CONSULTANT").emit("resource_update", data);
}, 10000);

app.post('/api/hospital', async (req, res) => {
   try {
      const result = await runHospitalOS(req.body);
      
      if (result.error && result.error.includes("INVALID CLINICAL INPUT")) {
         return res.status(400).json(result);
      }
      
      if (result.status === "SAFE_MODE") {
         return res.status(503).json(result);
      }
      
      res.json(result);
   } catch (e) {
      logger.error(`Hospital OS API Error: ${e.message}`);
      res.status(500).json({ error: "INTERNAL_SYSTEM_FAILURE", detail: e.message });
   }
});

app.get('/api/clinical/triage', requireAuth, async (req, res) => {
   try {
      const triage = await broadcastTriage();
      res.json(triage);
   } catch (e) {
      res.status(500).json({ error: e.message });
   }
});

// Moved to bottom for middleware consistency

// Moved to bottom for middleware consistency

// --- REDIS PERSISTENCE ---
let redisClient = null;
let isRedisAvailable = false;
/* (async () => {
    try {
        redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
        ...
    } catch (err) {
        logger.warn(`Redis unavailable â€” fallback active: ${err.message}`);
        isRedisAvailable = false;
    }
})(); */

const persistPatient = async (pt) => {
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

const persistAlert = async (alert) => {
    if (isRedisAvailable && redisClient && alert) {
        try {
            await redisClient.set(`alert:${alert.caseId}`, JSON.stringify(alert));
        } catch (e) { }
    }
};

const persistAudit = async (caseId, logName, data) => {
    if (isRedisAvailable && redisClient) {
        try {
            await redisClient.rPush(`audit:${caseId}`, JSON.stringify({ logName, timestamp: Date.now(), data }));
        } catch (e) { }
    }
};

const activeAlerts = new Map();
const activePatients = new Map();
const alertCooldowns = new Map();

// --- SLA CONFIGURATION ---
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

app.locals.io = io;

io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error"));
    
    if (typeof isRedisAvailable !== 'undefined' && isRedisAvailable && redisClient) {
        const data = await redisClient.get(`session:${token}`);
        if (!data) return next(new Error("Authentication error"));
        socket.user = JSON.parse(data);
        next();
    } else {
        socket.user = { name: 'Fallback', role: 'doctor' };
        next();
    }
});

io.on("connection", (socket) => {
  logger.info(`Client connected to clinical telemetry socket: ${socket.id} - User: ${socket.user?.name}`);

   socket.on("pathway_step_complete", async ({ caseId, stepIndex, stepData, user }) => {
     const actor = user || socket.user || { name: 'Clinician' };
     const rClient = isRedisAvailable && redisClient ? redisClient : null;
     
     // Ensure in-memory exists as fallback
     if (!clinicalExecutionLogs.has(caseId)) {
        clinicalExecutionLogs.set(caseId, []);
     }
     const memLogs = clinicalExecutionLogs.get(caseId);
     
     // Mark step as completed (updates Redis or in-memory)
     const result = await completeStep(caseId, stepIndex, actor.name, rClient, memLogs);
     if (result) {
        clinicalExecutionLogs.set(caseId, result.logs);
        lastActionAtMap.set(caseId, Date.now()); // track inactivity
     }

     // Run full compliance analysis
     const compliance = await runComplianceAnalysis(caseId, rClient, clinicalExecutionLogs.get(caseId));
     if (!compliance) return;

     // Broadcast execution update to all clients
     io.emit('pathway_execution_update', { caseId, compliance });
     logger.info(`Execution [${caseId}]: Score=${compliance.complianceScore} Complete=${compliance.completionRate}%`);

     // â”€â”€â”€ Run Smart Suggestion Engine
     const pt = activePatients.get(caseId);
     if (pt && pt.fullData?.ventilatorStatus?.predictiveIntel) {
        const { clinicalPathway, predictedRisk, riskScore, trends } = pt.fullData.ventilatorStatus.predictiveIntel;
        const suggestion = runSuggestionEngine({
           pathway:        clinicalPathway || null,
           executionLogs:  clinicalExecutionLogs.get(caseId) || [],
           predictedRisk:  predictedRisk || 'LOW',
           riskScore:      riskScore || 0,
           vitals:         pt.lastVitals || {},
           lastActionAt:   lastActionAtMap.get(caseId) || null,
        });
        io.emit('suggestion_update', { caseId, suggestion });
        logger.info(`Suggestion [${caseId}]: ${suggestion.topSuggestion?.action}`);
     }

     // â”€â”€â”€ Emit critical SLA breach alert for MISSED IMMEDIATE steps
     if (compliance.criticalAlerts && compliance.criticalAlerts.length > 0) {
        compliance.criticalAlerts.forEach(alert => {
           io.emit('sla_breach_critical', { caseId, ...alert });
           logger.warn(`SLA CRITICAL BREACH [${caseId}]: ${alert.message}`);
        });
     }

     // â”€â”€â”€ Emit poor compliance alert if score < 70
     if (compliance.poorCompliance) {
        io.emit('poor_compliance_alert', {
           caseId,
           complianceScore: compliance.complianceScore,
           missedSteps:     compliance.missedSteps,
           message:         `âš ï¸ Clinical compliance score dropped to ${compliance.complianceScore}/100`,
        });
        logger.warn(`POOR COMPLIANCE [${caseId}]: ${compliance.complianceScore}/100`);
     }
  });

  if (socket.user && socket.user.role) {
      socket.join(socket.user.role.toUpperCase());
  }

  socket.on("ack_alert", (data) => {
    const caseId = data.caseId || data;
    const user = data.user || socket.user || { name: 'Unknown', role: 'Unknown', userId: 'None' };
    
    if (activeAlerts.has(caseId)) {
      const alert = activeAlerts.get(caseId);
      if (alert.acknowledged) return;
      alert.acknowledged = true;
      alert.acknowledgedBy = user;
      alert.acknowledgedAt = Date.now();
      
      if (alert.timeMs) {
          recordTiming('Ack', Date.now() - alert.timeMs);
      }
      activeAlerts.set(caseId, alert);
      persistAlert(alert);
      io.emit("alert_acknowledged", alert);
      logger.info(`Alert ${caseId} ACKNOWLEDGED by ${user.name} (${user.role}).`);
      persistAudit(caseId, 'ACKNOWLEDGE', { user, alertType: alert.alertType });
      
      // Secondary Escalator (2 minutes No Action)
      setTimeout(() => {
         const currentAlert = activeAlerts.get(caseId);
         if (currentAlert && currentAlert.actions.length === 0) {
            currentAlert.escalated = true;
            currentAlert.noActionTaken = true;
            activeAlerts.set(caseId, currentAlert);
            io.to('CONSULTANT').emit('critical_alert', currentAlert);
            console.log(`ðŸš¨ ALERT ${caseId} RE-ESCALATED: NO ACTION LOGGED IN 120s`);
         }
      }, 120000);
    }
  });

  socket.on("log_action", ({ caseId, action, user }) => {
     const actor = user || socket.user || { name: 'Unknown' };
     if (activeAlerts.has(caseId)) {
        const alert = activeAlerts.get(caseId);
        const actionLog = {
           action,
           performedBy: actor,
           timestamp: new Date().toLocaleTimeString()
        };
        alert.actions.push(actionLog);
        activeAlerts.set(caseId, alert);
        persistAlert(alert);
        
        if (alert.acknowledgedAt) {
            recordTiming('Action', Date.now() - alert.acknowledgedAt);
        }
        
        io.emit("action_logged", { caseId, actionLog });
        logger.info(`Action ${action} logged for ${caseId} by ${actor.name}`);
        persistAudit(caseId, 'LOG_ACTION', actionLog);
     }
  });

  socket.on("assign_task", (payload) => {
     const actor = payload.user || socket.user || { name: 'Unknown' };
     if (activePatients.has(payload.caseId)) {
        const pt = activePatients.get(payload.caseId);
        pt.assignedTo = payload.assignedTo;
        pt.assignedBy = actor;
        
        const slaMs = getSlaDuration(payload.task);
        const newTask = {
           id: Date.now().toString(),
           task: payload.task,
           assignedTo: payload.assignedTo,
           assignedBy: actor,
           status: 'pending',
           createdAt: Date.now(),
           dueBy: Date.now() + slaMs,
           escalationLevel: 0
        };
        pt.tasks = pt.tasks || [];
        pt.tasks.push(newTask);
        
        activePatients.set(payload.caseId, pt);
        persistPatient(pt);
        persistAudit(payload.caseId, 'ASSIGN_TASK', newTask);
        logger.info(`Task assigned: ${payload.task} on ${payload.caseId} by ${actor.name}`);
        io.emit("patient_tasks_updated", { caseId: payload.caseId, patient: pt });
     }
  });

  socket.on("complete_task", ({ caseId, taskId, user }) => {
     const actor = user || socket.user || { name: 'Unknown' };
     if (activePatients.has(caseId)) {
        const pt = activePatients.get(caseId);
        if (pt.tasks) {
           const taskIndex = pt.tasks.findIndex(t => t.id === taskId);
           if (taskIndex !== -1) {
              pt.tasks[taskIndex].status = 'completed';
              pt.tasks[taskIndex].completedAt = Date.now();
              pt.tasks[taskIndex].completedBy = actor;
              activePatients.set(caseId, pt);
              persistPatient(pt);
              persistAudit(caseId, 'COMPLETE_TASK', pt.tasks[taskIndex]);
              recordTiming('Completion', 1); // count for SLA percentages
              logger.info(`Task completed: taskId ${taskId} on ${caseId} by ${actor.name}`);
              io.emit("patient_tasks_updated", { caseId, patient: pt });
           }
        }
     }
  });

   socket.on("start_sbt", ({ caseId, user }) => {
      const actor = user || socket.user || { name: 'Unknown' };
      if (activePatients.has(caseId)) {
         let pt = activePatients.get(caseId);
         if (!pt.fullData.ventilatorStatus) pt.fullData.ventilatorStatus = {};
         pt.fullData.ventilatorStatus.sbt = {
            state: 'IN_PROGRESS',
            startTime: Date.now(),
            startedBy: actor
         };
         activePatients.set(caseId, pt);
         persistPatient(pt);
         io.emit('patient_tasks_updated', { caseId, patient: pt });
         incrementOutcome('totalSBTAttempts');
         logger.info(`SBT INITIATED for ${caseId} by ${actor.name}`);
      }
   });

   socket.on("update_abg", async ({ caseId, abg, spo2, hr, rr, override, user }) => {
      const actor = user || socket.user || { name: 'Unknown' };
      if (activePatients.has(caseId)) {
         let pt = activePatients.get(caseId);
         
         if (pt.fullData?.ventilatorStatus?.sbt?.state === 'EXTUBATED') {
            const extTime = pt.fullData.ventilatorStatus.sbt.extubatedAt || Date.now();
            const elapsedMins = (Date.now() - extTime) / 60000;
            
            const curSpo2 = parseFloat(spo2) || 100;
            const curHr = parseFloat(hr) || 0;
            const curRr = parseFloat(rr) || 0;
            
            const rLevel = pt.fullData.ventilatorStatus.sbt.extubationRisk?.level || 'LOW';
            const failSpo2 = rLevel === 'HIGH' ? 92 : 90;
            const failRr = rLevel === 'HIGH' ? 28 : 30;
            const failHr = rLevel === 'HIGH' ? 130 : 140;
            
            let peStatus = 'STABLE';
            let alerts = [];
            let recs = [];
            
            if ((curSpo2 > 0 && curSpo2 < failSpo2) || (curRr > 0 && curRr > failRr) || (curHr > 0 && curHr > failHr)) {
                peStatus = 'FAILED';
                incrementOutcome('extubationFailures');
                if (curSpo2 > 0 && curSpo2 < failSpo2) alerts.push(`SpO2 ${curSpo2}% < ${failSpo2}%`);
                if (curRr > 0 && curRr > failRr) alerts.push(`RR ${curRr} > ${failRr}`);
                if (curHr > 0 && curHr > failHr) alerts.push(`HR ${curHr} > ${failHr}`);
                recs.push("POST-EXTUBATION FAILURE â€” consider NIV or reintubation immediately");
                
                io.emit('critical_alert', {
                   caseId: pt.caseId, patientName: pt.patientName,
                   alertType: `POST-EXTUBATION FAILURE`, severity: 'Critical',
                   timestamp: new Date().toLocaleTimeString(), fullData: pt.fullData
                });
            } else if (elapsedMins >= 120) {
                peStatus = 'SUCCESS';
                alerts.push("Extubation successful â€” continue monitoring");
            } else {
                peStatus = rLevel === 'HIGH' ? 'AT RISK' : 'STABLE';
                if (rLevel === 'HIGH') alerts.push("High-risk patient â€” monitor closely");
            }
            
            pt.fullData.ventilatorStatus.postExtubation = { status: peStatus, timeSinceExtubation: Math.floor(elapsedMins), alerts, recs };
            if (!pt.fullData.vitals) pt.fullData.vitals = {};
            pt.fullData.vitals.abg = abg;
            pt.fullData.vitals.spo2 = spo2;
            
            activePatients.set(caseId, pt);
            persistPatient(pt);
            io.emit('patient_tasks_updated', { caseId, patient: pt });
            return;
         }
         
         const prevAbg = pt.fullData.vitals?.abg || null;
         const prevSpo2 = pt.fullData.vitals?.spo2 || null;
         
         const lastApplied = pt.fullData.ventilatorStatus?.appliedAt;
         if (lastApplied && (Date.now() - lastApplied < 15 * 60 * 1000)) {
            if (!override) {
               socket.emit("error_msg", "Ventilator changes locked for 15 minutes. Emergency override required.");
               return;
            } else {
               persistAudit(caseId, 'VENT_OVERRIDE', { reason: "Emergency override confirmed", user: actor });
               logger.warn(`VENT OVERRIDE executed by ${actor.name} on ${caseId}`);
            }
         }
         
         let sbtUpdate = pt.fullData.ventilatorStatus?.sbt;
         if (sbtUpdate && sbtUpdate.state === 'IN_PROGRESS') {
             const elapsedMinutes = (Date.now() - sbtUpdate.startTime) / 60000;
             const curSpo2 = parseFloat(spo2) || 100;
             const curHr = parseFloat(hr) || 0;
             const curRr = parseFloat(rr) || 0;
             
             if ((curRr > 35 && curRr !== 0) || (curSpo2 < 90 && curSpo2 !== 0) || (curHr > 140 && curHr !== 0)) {
                 sbtUpdate.state = 'FAILED';
                 sbtUpdate.failures = (sbtUpdate.failures || 0) + 1;
                 sbtUpdate.failureReason = "SBT FAILED â€” resume ventilator support (Patient not ready for extubation â€” reassess later)";
                 if (!pt.tasks) pt.tasks = [];
                 pt.tasks.push({ id: Date.now().toString(), task: "Resume full ventilator support", assignedTo: "Doctor", assignedBy: {name: 'Engine'}, status: 'pending', createdAt: Date.now(), dueBy: Date.now() + 300000, escalationLevel: 0 });
                 logger.error(`SBT FAILED for ${caseId} at ${elapsedMinutes.toFixed(1)} mins`);
             } else if (elapsedMinutes >= 30) {
                 sbtUpdate.state = 'SUCCESS';
                 sbtUpdate.successMessage = "SBT SUCCESS â€” consider extubation";
                 
                 const diagStr = ((pt.primaryDiagnosis || '') + ' ' + (pt.fullData.historyAnswers?.["Past medical history"] || '')).toLowerCase();
                 let rFactors = [];
                 if (pt.age && parseInt(pt.age) > 65) rFactors.push("Age > 65");
                 if (diagStr.includes('copd') || diagStr.includes('lung')) rFactors.push("COPD / chronic lung disease");
                 if (sbtUpdate.failures && sbtUpdate.failures > 0) rFactors.push("Previous SBT failure");
                 const vDays = pt.fullData.ventilatorStatus?.ventDays || 1;
                 if (vDays > 5) rFactors.push("Prolonged ventilation (>5 days)");
                 
                 const riskLevel = rFactors.length > 1 ? "HIGH" : "LOW";
                 sbtUpdate.extubationRisk = {
                     level: riskLevel,
                     factors: rFactors,
                     recommendation: riskLevel === "HIGH" 
                         ? "HIGH RISK OF EXTUBATION FAILURE: Consider NIV or HFNC immediately post-extubation"
                         : "LOW-MODERATE RISK: Proceed with standard extubation protocol",
                     safety: "Extubation decision requires clinical judgment and airway assessment"
                 };
                 
                 logger.info(`SBT COMPLETED for ${caseId} at ${elapsedMinutes.toFixed(1)} mins [Risk: ${riskLevel}]`);
             }
         }

         const calcWeight = pt.weight ? parseFloat(pt.weight) : 70;
         const newSettings = calculateVentilatorSettings(pt.primaryDiagnosis || pt.diagnosis, abg, spo2, calcWeight, pt.height, pt.gender);
         const responseTracking = calculateVentilatorResponse(prevAbg, abg, prevSpo2, spo2);
         
         if (!pt.fullData.vitals) pt.fullData.vitals = {};
         pt.fullData.vitals.abg = abg;
         pt.fullData.vitals.spo2 = spo2;
         
         if (!pt.fullData.vitalHistory) pt.fullData.vitalHistory = [];
         pt.fullData.vitalHistory.push({ abg, spo2, hr, rr, timestamp: Date.now() });
         if (pt.fullData.vitalHistory.length > 5) pt.fullData.vitalHistory.shift();
         
         // â”€â”€â”€ PREDICTIVE DETERIORATION ENGINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
         // Trend-based scoring across last 3-5 readings of SpO2, RR, HR, PaCO2, pH
         // Scoring: each abnormal trend +1 | ABG combined worsening (PaCO2â†‘+pHâ†“) +2
         // Risk:    0-1 â†’ LOW | 2-3 â†’ MODERATE | â‰¥4 â†’ HIGH
         
         let riskScore = 0;
         let trendSummary = [];
         let recommendation = "Continue current monitoring";

         // Per-vital trend arrows for UI rendering
         // "â†‘" = worsening direction, "â†“" = improving direction, "â†’" = stable
         const trends = { SpO2: 'â†’', RR: 'â†’', HR: 'â†’', PaCO2: 'â†’', pH: 'â†’' };
         
         const history = pt.fullData.vitalHistory;
         const n = history.length;

         if (n >= 2) {
             // Helper: get numeric value across readings, return null if unavailable
             const vals = (key, subKey) => history.map(h => {
                 const v = subKey ? parseFloat(h[key]?.[subKey]) : parseFloat(h[key]);
                 return isNaN(v) ? null : v;
             }).filter(v => v !== null);

             // â”€â”€ SpO2: falling trend = worsening
             const spo2Vals = vals('spo2');
             if (spo2Vals.length >= 2) {
                 const first = spo2Vals[0];
                 const last  = spo2Vals[spo2Vals.length - 1];
                 if (last < first) {
                     trends.SpO2 = 'â†“'; // falling SpO2 = worsening
                     if (last <= 94) {
                         riskScore += 1;
                         trendSummary.push(`SpO2 falling: ${first}% â†’ ${last}% (worsening oxygenation)`);
                     }
                 } else if (last > first) {
                     trends.SpO2 = 'â†‘'; // rising SpO2 = improving
                 }
             }

             // â”€â”€ RR: rising trend = worsening (respiratory distress)
             const rrVals = vals('rr');
             if (rrVals.length >= 2) {
                 const first = rrVals[0];
                 const last  = rrVals[rrVals.length - 1];
                 if (last > first) {
                     trends.RR = 'â†‘'; // rising RR = worsening
                     if (last >= 20) {
                         riskScore += 1;
                         trendSummary.push(`RR rising: ${first} â†’ ${last} /min (respiratory distress)`);
                     }
                 } else if (last < first) {
                     trends.RR = 'â†“'; // falling RR = improving
                 }
             }

             // â”€â”€ HR: rising trend = worsening
             const hrVals = vals('hr');
             if (hrVals.length >= 2) {
                 const first = hrVals[0];
                 const last  = hrVals[hrVals.length - 1];
                 if (last > first) {
                     trends.HR = 'â†‘'; // rising HR = worsening
                     if (last >= 100) {
                         riskScore += 1;
                         trendSummary.push(`HR rising: ${first} â†’ ${last} bpm (tachycardia progression)`);
                     }
                 } else if (last < first) {
                     trends.HR = 'â†“'; // falling HR = improving
                 }
             }

             // â”€â”€ ABG: PaCO2â†‘ + pHâ†“ together = ventilation failure (+2)
             const pco2Vals = vals('abg', 'pco2');
             const phVals   = vals('abg', 'ph');
             
             let abgWorseningScore = 0;
             if (pco2Vals.length >= 2) {
                 const first = pco2Vals[0];
                 const last  = pco2Vals[pco2Vals.length - 1];
                 if (last > first) {
                     trends.PaCO2 = 'â†‘'; // rising PaCO2 = worsening
                     abgWorseningScore += 1;
                 } else if (last < first) {
                     trends.PaCO2 = 'â†“'; // falling PaCO2 = improving
                 }
             }
             if (phVals.length >= 2) {
                 const first = phVals[0];
                 const last  = phVals[phVals.length - 1];
                 if (last < first) {
                     trends.pH = 'â†“'; // falling pH = worsening
                     abgWorseningScore += 1;
                 } else if (last > first) {
                     trends.pH = 'â†‘'; // rising pH = improving
                 }
             }
             // Combined ABG deterioration = +2 (ventilation failure pattern)
             if (abgWorseningScore === 2) {
                 riskScore += 2;
                 trendSummary.push(`ABG deteriorating: PaCO2â†‘ + pHâ†“ â†’ ventilation failure pattern`);
             } else if (abgWorseningScore === 1) {
                 riskScore += 1;
                 trendSummary.push(`ABG partial worsening: ${trends.PaCO2 === 'â†‘' ? 'PaCO2 rising' : 'pH falling'}`);
             }
         }
         
         // â”€â”€ Extubation risk modifier
         const extRiskLvl = pt.fullData.ventilatorStatus?.sbt?.extubationRisk?.level;
         if (extRiskLvl === 'HIGH') {
             riskScore += 1;
             trendSummary.push("High probability of post-extubation failure (Risk: HIGH)");
         }
         if (pt.fullData.ventilatorStatus?.sbt?.failures > 0) {
             riskScore += 1;
         }

         // â”€â”€ Final Risk Classification: 0-1=LOW | 2-3=MODERATE | â‰¥4=HIGH
         let predictedRisk = "LOW";
         if (riskScore >= 4) {
             predictedRisk = "HIGH";
             recommendation = "âš ï¸ High risk of deterioration â€” intervene early";
             io.emit('predictive_alert', {
                 caseId, patientName: pt.patientName,
                 msg: recommendation, score: riskScore, trends
             });
             logger.warn(`PREDICTIVE ALERT [HIGH] for ${caseId} | Score: ${riskScore} | Trends: ${JSON.stringify(trends)}`);
         } else if (riskScore >= 2) {
             predictedRisk = "MODERATE";
             recommendation = "Moderate risk â€” increase monitoring frequency";
         }

         // â”€â”€â”€ CLINICAL ACTION PRIORITY ENGINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
         // Converts prediction â†’ actionable bedside decision
         // Input:  predictiveRisk, riskScore, trends, currentVitals, diagnosis
         // Output: priorityLevel, probableFailureType, recommendedActions, timeToAct
         
         let actionPriority = null;
         {
             const currentSpo2 = parseFloat(spo2) || 0;
             const currentRr   = parseFloat(rr)   || 0;
             const currentHr   = parseFloat(hr)   || 0;
             const currentPco2 = parseFloat(abg?.pco2) || 0;
             const currentPh   = parseFloat(abg?.ph)   || 0;
             const currentSbp  = parseFloat(pt.fullData?.vitals?.sbp) || null;
             const diagnosis   = pt.primaryDiagnosis || pt.diagnosis || '';

             let priorityLevel         = 'ROUTINE';
             let probableFailureType   = 'None detected';
             let recommendedActions    = [];
             let timeToAct             = '> 60 min';
             let failureScore          = { hypoxia: 0, ventilation: 0, shock: 0 };

             // â”€â”€ Pattern 1: Hypoxia (SpO2â†“ AND RRâ†‘)
             if (trends.SpO2 === 'â†“' && trends.RR === 'â†‘') {
                 failureScore.hypoxia += 2;
             }
             if (currentSpo2 > 0 && currentSpo2 < 90)  failureScore.hypoxia += 2;
             if (currentSpo2 > 0 && currentSpo2 < 94)  failureScore.hypoxia += 1;
             if (trends.SpO2 === 'â†“')                   failureScore.hypoxia += 1;

             // â”€â”€ Pattern 2: Ventilation Failure (PaCO2â†‘ + pHâ†“)
             if (trends.PaCO2 === 'â†‘' && trends.pH === 'â†“') {
                 failureScore.ventilation += 3;
             }
             if (currentPco2 > 50)  failureScore.ventilation += 2;
             if (currentPh  > 0 && currentPh < 7.3 )  failureScore.ventilation += 2;

             // â”€â”€ Pattern 3: Shock (HRâ†‘ + BPâ†“ or low absolute BP)
             if (trends.HR === 'â†‘') failureScore.shock += 1;
             if (currentHr > 110)   failureScore.shock += 1;
             if (currentSbp !== null && currentSbp < 90) failureScore.shock += 3;

             // â”€â”€ Determine Dominant Failure Pattern
             const maxScore = Math.max(failureScore.hypoxia, failureScore.ventilation, failureScore.shock);

             if (maxScore === 0 || predictedRisk === 'LOW') {
                 // No dominant pattern â†’ routine care
                 priorityLevel       = 'ROUTINE';
                 probableFailureType = 'No dominant failure pattern';
                 recommendedActions  = ['Continue standard monitoring', 'Reassess vitals per protocol'];
                 timeToAct           = '> 60 min';

             } else if (failureScore.hypoxia >= failureScore.ventilation && failureScore.hypoxia >= failureScore.shock) {
                 // â”€â”€ HYPOXIA PATTERN â”€â”€
                 probableFailureType = 'Hypoxia / Oxygenation Failure';
                 if (currentSpo2 < 88 || predictedRisk === 'HIGH') {
                     priorityLevel     = 'IMMEDIATE';
                     timeToAct         = '0â€“10 min';
                     recommendedActions = [
                         'ðŸ”´ Escalate oxygen â€” switch to High-Flow Nasal Cannula (HFNC) or NRB mask',
                         'ðŸ”´ Reposition patient (Head-up 30Â°)',
                         'ðŸ”´ Call respiratory therapy / anaesthesia NOW',
                         'ðŸŸ¡ Reassess for secretion retention â€” suction if intubated',
                         'ðŸŸ¡ Check FiO2 and PEEP settings â€” consider PEEP increase',
                         'âšª Arterial Blood Gas within 15 minutes of oxygen escalation'
                     ];
                 } else {
                     priorityLevel     = 'URGENT';
                     timeToAct         = '30 min';
                     recommendedActions = [
                         'ðŸŸ¡ Increase supplemental oxygen flow',
                         'ðŸŸ¡ Check SpO2 probe placement and perfusion',
                         'ðŸŸ¡ Reassess in 15 minutes; escalate if SpO2 < 92%',
                         'âšª Review recent chest X-ray and auscultate breath sounds'
                     ];
                 }

             } else if (failureScore.ventilation >= failureScore.shock) {
                 // â”€â”€ VENTILATION FAILURE PATTERN â”€â”€
                 probableFailureType = 'Ventilation Failure / Hypercapnia';
                 if (predictedRisk === 'HIGH' || currentPco2 > 55 || currentPh < 7.25) {
                     priorityLevel     = 'IMMEDIATE';
                     timeToAct         = '0â€“10 min';
                     recommendedActions = [
                         'ðŸ”´ Increase ventilator Respiratory Rate immediately',
                         'ðŸ”´ Consider switching to Pressure Control mode to offload respiratory muscles',
                         'ðŸ”´ Notify intensivist / attending physician STAT',
                         'ðŸŸ¡ Increase tidal volume cautiously (maintain Pplat < 30 cmH2O)',
                         'ðŸŸ¡ Check for ETT obstruction, secretions, or circuit leak',
                         'âšª Repeat ABG in 20 minutes to assess response'
                     ];
                 } else {
                     priorityLevel     = 'URGENT';
                     timeToAct         = '30 min';
                     recommendedActions = [
                         'ðŸŸ¡ Increase RR by 2â€“4 breaths/minute on ventilator',
                         'ðŸŸ¡ Monitor capnography if available',
                         'ðŸŸ¡ Reassess ABG in 30 minutes',
                         'âšª Assess patient-ventilator synchrony'
                     ];
                 }

             } else {
                 // â”€â”€ SHOCK / HEMODYNAMIC INSTABILITY PATTERN â”€â”€
                 probableFailureType = 'Hemodynamic Instability / Shock';
                 if (predictedRisk === 'HIGH' || (currentSbp !== null && currentSbp < 80)) {
                     priorityLevel     = 'IMMEDIATE';
                     timeToAct         = '0â€“10 min';
                     recommendedActions = [
                         'ðŸ”´ Administer IV fluid bolus (Normal Saline 250â€“500 mL over 15 min)',
                         'ðŸ”´ Consider vasopressors (Norepinephrine â€” check contraindications)',
                         'ðŸ”´ Obtain IV access x2, send urgent labs (lactate, CBC, BMP)',
                         'ðŸ”´ Call intensivist STAT',
                         'ðŸŸ¡ 12-lead ECG to rule out obstructive cause (STEMI / tamponade)',
                         'âšª Bladder catheter for hourly urine output monitoring'
                     ];
                 } else {
                     priorityLevel     = 'URGENT';
                     timeToAct         = '30 min';
                     recommendedActions = [
                         'ðŸŸ¡ Administer cautious fluid challenge and reassess BP',
                         'ðŸŸ¡ Review medication list for hypotensive agents',
                         'ðŸŸ¡ Check 12-lead ECG',
                         'âšª Reassess MAP in 15 minutes; escalate if MAP < 65 mmHg'
                     ];
                 }
             }

             actionPriority = { priorityLevel, probableFailureType, recommendedActions, timeToAct };

             // â”€â”€ Emit clinical priority alert for IMMEDIATE/URGENT cases
             if (predictedRisk !== 'LOW' && (priorityLevel === 'IMMEDIATE' || priorityLevel === 'URGENT')) {
                 io.emit('clinical_priority_alert', {
                     caseId, patientName: pt.patientName,
                     priorityLevel, probableFailureType, timeToAct,
                     recommendedActions: recommendedActions.slice(0, 2) // top priorities only in push
                 });
                 logger.warn(`CLINICAL PRIORITY [${priorityLevel}] for ${caseId} | Failure: ${probableFailureType} | Act in: ${timeToAct}`);
             }
         }
         // â”€â”€â”€ END CLINICAL ACTION PRIORITY ENGINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

         const predictiveIntel = {
             predictedRisk, riskScore, trends, trendSummary, recommendation, actionPriority
         };

         // â”€â”€â”€ CLINICAL PATHWAY ENGINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
         // Evidence-based pathway guide: maps diagnosis â†’ checklist, time targets, warnings
         // SAFETY: Decision support ONLY â€” no auto-execution
         try {
             const pathway = runClinicalPathwayEngine({
                 diagnosis: pt.primaryDiagnosis || pt.diagnosis,
                 probableFailureType: actionPriority?.probableFailureType,
                 priorityLevel: actionPriority?.priorityLevel,
                 vitals: { spo2, rr, hr, abg, sbp: pt.fullData?.vitals?.sbp }
             });
             predictiveIntel.clinicalPathway = pathway;
             // Initialize/Reset execution logs for new clinical pathway (bulk-assign all steps with SLA)
             const prevPathwayKey = (clinicalExecutionLogs.get(caseId) || [])[0]?.slaCategory !== undefined 
                ? (clinicalExecutionLogs.get(caseId) || [])._pathwayKey
                : null;
             if (prevPathwayKey !== pathway.pathwayKey) {
                const rClient = isRedisAvailable && redisClient ? redisClient : null;
                const logs = await initPathwayLog(caseId, pathway.checklist, rClient);
                logs._pathwayKey = pathway.pathwayKey;
                clinicalExecutionLogs.set(caseId, logs);
             }
             logger.info(`PATHWAY [${pathway.pathwayKey}] for ${caseId}: ${pathway.pathwayName}`);
         } catch (e) {
             logger.warn(`Pathway engine error for ${caseId}: ${e.message}`);
         }
         // â”€â”€â”€ END CLINICAL PATHWAY ENGINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

         pt.fullData.ventilatorStatus = {
            state: "SUGGESTED",
            settings: newSettings,
            responseTracking: responseTracking,
            sbt: sbtUpdate || null,
            predictiveIntel,
            approvedBy: null, approvedAt: null, appliedBy: null, appliedAt: null
         };
         
         activePatients.set(caseId, pt);
         persistPatient(pt);
         persistAudit(caseId, 'UPDATE_ABG', pt.fullData.vitals);
         io.emit('patient_tasks_updated', { caseId, patient: pt });
      }
   });

   socket.on("execute_extubation", ({ caseId, user }) => {
      const actor = user || socket.user || { name: 'Unknown' };
      if (activePatients.has(caseId)) {
         let pt = activePatients.get(caseId);
         if (pt.fullData?.ventilatorStatus?.sbt) {
            pt.fullData.ventilatorStatus.sbt.state = 'EXTUBATED';
            pt.fullData.ventilatorStatus.sbt.extubatedBy = actor;
            pt.fullData.ventilatorStatus.sbt.extubatedAt = Date.now();
            activePatients.set(caseId, pt);
            persistPatient(pt);
            incrementOutcome('extubations');
            persistAudit(caseId, 'PATIENT_EXTUBATED', { reason: "Extubation approved by " + actor.name, user: actor });
            logger.info(`Extubation approved by ${actor.name} on ${caseId}`);
            io.emit('patient_tasks_updated', { caseId, patient: pt });
         }
      }
   });

   socket.on("disconnect", () => {
     console.log("Client disconnected:", socket.id);
   });
});

app.set("activeAlerts", activeAlerts);
app.set("dispatchAlert", (targetRooms, alertPayload) => {
   const alertSignature = `${alertPayload.caseId}:${alertPayload.alertType}`;
   const severityLevels = { 'Stable': 0, 'Standard': 1, 'Moderate': 2, 'Critical': 3, 'CRITICAL_CONFLICT': 4 };
   const currentSev = severityLevels[alertPayload.severity] || 0;

   if (alertCooldowns.has(alertSignature)) {
      const last = alertCooldowns.get(alertSignature);
      const lastSev = severityLevels[last.severity] || 0;
      
      // Suppress only if severity hasn't worsened within 60s
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
   persistAlert(enrichedAlert);
   incrementMetric('totalAlerts');
   logger.info(`Alert emitted: ${enrichedAlert.caseId} - ${enrichedAlert.alertType}`);
   targetRooms.forEach(room => io.to(room).emit('critical_alert', enrichedAlert));
   
   // Backoff Escalation (Max 3)
   let escLevel = 1;
   const scheduleEscalation = (delayMs) => {
      setTimeout(() => {
         const currentAlert = activeAlerts.get(alertPayload.caseId);
         if (currentAlert && !currentAlert.acknowledged && escLevel <= 3) {
            currentAlert.escalated = true;
            currentAlert.escalationLevel = escLevel;
            activeAlerts.set(alertPayload.caseId, currentAlert);
            persistAlert(currentAlert);
            io.to('CONSULTANT').emit('critical_alert', currentAlert);
            logger.warn(`ðŸš¨ ALERT ${alertPayload.caseId} ESCALATED (Level ${escLevel})`);
            incrementMetric('escalations');
            persistAudit(alertPayload.caseId, 'ESCALATION', { escLevel });
            escLevel++;
            scheduleEscalation(escLevel === 2 ? 60000 : 120000); // 30s -> 60s -> 120s
         }
      }, delayMs);
   };
   scheduleEscalation(30000);
});

app.set("updateActivePatient", (patientData) => {
   activePatients.set(patientData.caseId, patientData);
   persistPatient(patientData);
});

// Periodic 5s Emit & SLA Evaluator
setInterval(() => {
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
      
      // Predictive Modeling & SLA Task Checks
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
                  persistPatient(pt);
               } else if (t.atRisk) {
                  priorityScore += 60;
               }
               
               if (diff <= 0) priorityScore += 120;
               
               if (now > t.dueBy && !t.escalated) {
                  t.escalated = true;
                  t.escalationLevel = 1;
                  incrementMetric('overdueTasks');
                  logger.warn(`SLA Breach: ${t.task} overdue on ${pt.caseId}`);
                  
                  const bottleneckMem = global.bottleneckMem || (global.bottleneckMem = {});
                  bottleneckMem[t.task] = (bottleneckMem[t.task] || 0) + 1;
                  if (bottleneckMem[t.task] > 1 && bottleneckMem[t.task] % 2 === 0) {
                      logger.warn(`System bottleneck detected in [${t.task}]`);
                      io.emit('critical_alert', {
                         caseId: 'SYSTEM',
                         patientName: 'ICU Analytics Engine',
                         alertType: `âš ï¸ SYSTEM BOTTLENECK DETECTED`,
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
                  persistPatient(pt);
               }
            }
         });
      }
      
      snapshot.push(pt);
   }
   
   io.emit("patient_snapshot", snapshot);
}, 5000);

// Redundant imports and middleware removed

const clinicalRoutes = require('./routes/clinicalRoutes');
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 30, 
  message: { error: "Too many requests â€” please retry" }
});
app.use('/api', limiter);
app.use('/api', clinicalRoutes);

if (!global.doctorRoutes) app.use("/doctors", require("./routes/doctorRoutes"));
if (!global.dashboardRoutes) app.use("/dashboard", require("./routes/dashboardRoutes"));
if (!global.registryRoutes) app.use("/registry", require("./routes/registryRoutes"));
if (!global.complianceRoutes) app.use("/compliance", require("./routes/complianceRoutes"));


const pharmacyService = require('./services/pharmacyService');

app.get('/api/pharmacy/stock/:query', async (req, res) => {
   try {
      const { query } = req.params;
      const brands = pharmacyService.getAvailableBrands(query);
      res.json(brands);
   } catch (e) {
      res.status(500).json({ error: e.message });
   }
});

const { interpretReport } = require('./services/reportInterpreter');

app.post('/api/clinical/interpret-report', async (req, res) => {
   try {
      const { reportText, symptoms, vitals } = req.body;
      const interpretation = interpretReport(reportText, symptoms, vitals);
      res.json(interpretation);
   } catch (e) {
      res.status(500).json({ error: e.message });
   }
});

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/clinical-opd")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error (proceeding in safe mode):", err.message));

// ðŸ”¥ REGISTER MODELS
require("./models/Patient");
require("./models/Facility");
require("./models/Visit");
require("./models/Doctor");
// Routes
// Visit routes moved or checked
if (!global.visitRoutes) app.use("/visits", require("./routes/visitRoutes"));

// --- AUTH & CLINICAL NOTES (CONSOLIDATED) ---
app.post('/api/auth/login', async (req, res) => {
    const { name, role } = req.body;
    if (!name || !role) return res.status(400).json({ error: "Missing identity" });
    const userId = randomUUID();
    const token = randomUUID();
    const sessionData = { userId, name, role, createdAt: Date.now() };
    
    if (typeof isRedisAvailable !== 'undefined' && isRedisAvailable && redisClient) {
        await redisClient.set(`session:${token}`, JSON.stringify(sessionData), { EX: 8 * 60 * 60 });
    }
    res.json({ token, user: sessionData });
});

app.get('/api/clinical/notes/:caseId', requireAuth, async (req, res) => {
   try {
      const rClient = isRedisAvailable && redisClient ? redisClient : null;
      const notes = await getClinicalNotes(req.params.caseId, rClient);
      res.json(notes);
   } catch (e) {
      res.status(500).json({ error: e.message });
   }
});

app.post('/api/clinical/notes', requireAuth, async (req, res) => {
   try {
      const { caseId, type, content, user, roundId, parentNoteId, isAddendum } = req.body;
      const rClient = isRedisAvailable && redisClient ? redisClient : null;
      const entry = await addClinicalNote(caseId, rClient, { 
         type, content, user, roundId, parentNoteId, isAddendum 
      });
      
      if (entry.isAddendum) { io.emit('note_addendum', { caseId, entry }); } 
      else { io.emit('note_added', { caseId, entry }); }

      if (entry.isCritical) {
         io.emit('critical_note_alert', { caseId, entry, message: `ðŸš¨ CRITICAL NOTE by ${user.name}: Potential Deterioration` });
      }
      res.json(entry);
   } catch (e) {
      res.status(500).json({ error: e.message });
   }
});

app.get('/api/clinical/discharge/:caseId', requireAuth, async (req, res) => {
   try {
      const { caseId } = req.params;
      const rClient = isRedisAvailable && redisClient ? redisClient : null;
      
      const summary = await generateDischargeSummary(caseId, rClient);
      
      if (isRedisAvailable && redisClient) {
         await redisClient.set(`discharge:${caseId}`, JSON.stringify(summary));
      }
      
      res.json(summary);
   } catch (e) {
      logger.error(`Discharge Engine Error: ${e.message}`);
      res.status(500).json({ error: e.message });
   }
});

// --- Claim Auto-Fix: Apply Documentation Remediation ---
app.post("/api/clinical/notes/add", requireAuth, async (req, res) => {
  const { caseId, text, source = "manual" } = req.body;

  if (!caseId || !text) {
    return res.status(400).json({ error: "caseId and text required" });
  }

  const rClient = isRedisAvailable && redisClient ? redisClient : null;
  
  // Map to the existing notesService schema
  const noteData = {
    content: text,
    user: req.user,
    type: source === "ClaimAutoFix" ? "AUTO_FIX" : "CLINICAL_NOTE",
    autoGenerated: source === "ClaimAutoFix",
    source
  };

  try {
     const entry = await addClinicalNote(caseId, rClient, noteData);

     // Secure Audit Log
     await persistAudit(caseId, 'AUTO_FIX_APPLIED', { 
       source, 
       textPreview: typeof text === 'string' ? text.slice(0, 80) : "Complex Object",
       user: req.user 
     });

     io.emit("notes_updated", { caseId, note: entry });

     res.json({ success: true, note: entry });
  } catch (err) {
     logger.error(`Auto-Fix Apply Error: ${err.message}`);
     res.status(500).json({ error: "Failed to apply fix", details: err.message });
  }
});

// --- Insurance Justification Engine v2 (Claim-Approval Grade) ---
app.get('/api/clinical/insurance/:caseId', requireAuth, async (req, res) => {
   try {
      const { caseId } = req.params;
      const rClient = isRedisAvailable && redisClient ? redisClient : null;
      
      const report = await generateInsuranceJustification(caseId, rClient);
      
      if (report.error === 'RED_FLAG_REJECTION') {
         return res.status(422).json(report);
      }
      
      res.json(report);
   } catch (e) {
      logger.error(`Insurance Justification Error: ${e.message}`);
      res.status(500).json({ error: e.message });
   }
});

// --- Medico-Legal Verifiable PDF Engine v3.1 ---
app.get('/api/clinical/pdf/:caseId', requireAuth, async (req, res) => {
   try {
      const { caseId } = req.params;
      const { type } = req.query; // 'discharge' or 'insurance'
      if (!type) return res.status(400).json({ error: "Document type required (discharge|insurance)" });
      
      const rClient = isRedisAvailable && redisClient ? redisClient : null;
      const pdfBuffer = await generateVerifiablePDF({ type, caseId, user: req.user, redisClient: rClient });
      
      persistAudit(caseId, 'PDF_GENERATED', { type, user: req.user });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${type}-${caseId}.pdf`);
      res.send(pdfBuffer);
   } catch (e) {
      logger.error(`PDF Engine Error: ${e.message}`);
      res.status(500).json({ error: e.message });
   }
});

app.get('/api/clinical/verify/:documentId', async (req, res) => {
   try {
      const { documentId } = req.params;
      const { v } = req.query; // version
      if (!v) return res.status(400).json({ error: "Document version required" });
      
      const rClient = isRedisAvailable && redisClient ? redisClient : null;
      const result = await verifyPDF(documentId, v, rClient);
      
      if (result.status === 'VALID') {
         persistAudit(result.metadata.caseId, 'PDF_VERIFIED', { documentId, version: v });
      } else {
         persistAudit(result.metadata?.caseId || 'UNKNOWN', 'PDF_INVALID_ATTEMPT', { documentId, version: v, reason: result.reason });
      }
      
      res.json(result);
   } catch (e) {
      logger.error(`Verification Engine Error: ${e.message}`);
      res.status(500).json({ error: e.message });
   }
});

// Billing Intelligence Endpoint
app.get('/api/clinical/billing/:caseId', async (req, res) => {
   try {
      const { caseId } = req.params;
      const rClient = isRedisAvailable && redisClient ? redisClient : null;
      const billingReport = await generateBillingIntelligence(caseId, rClient);
      
      if (billingReport.error) {
         return res.status(404).json(billingReport);
      }

      // Emit alerts if risk found
      if (billingReport.claimScore < 70) {
         io.emit('billing_risk_alert', { caseId, score: billingReport.claimScore, risks: billingReport.denialRisks });
      }
      if (billingReport.revenueLeaks?.length > 0) {
         io.emit('revenue_leak_alert', { caseId, leaks: billingReport.revenueLeaks });
      }

      res.json(billingReport);
   } catch (e) {
      logger.error(`Billing Engine Error: ${e.message}`);
      res.status(500).json({ error: e.message });
   }
});

// Claim Auto-Fix Endpoint
app.get('/api/clinical/billing/fixes/:caseId', async (req, res) => {
   try {
      const { caseId } = req.params;
      const rClient = isRedisAvailable && redisClient ? redisClient : null;
      const billingReport = await generateBillingIntelligence(caseId, rClient);
      
      if (billingReport.error) {
         return res.status(404).json(billingReport);
      }

      const fixes = runClaimAutoFixEngine(billingReport, billingReport.timeline);
      res.json(fixes);
   } catch (e) {
      logger.error(`Claim Auto-Fix Error: ${e.message}`);
      res.status(500).json({ error: e.message });
   }
});

// --- Claim Guard: Final Submission Safety Check ---
app.get("/api/clinical/claim/guard/:caseId", async (req, res) => {
  try {
    const { caseId } = req.params;
    const rClient = isRedisAvailable && redisClient ? redisClient : null;
    const billing = await generateBillingIntelligence(caseId, rClient);
    
    if (billing.error) {
       return res.status(404).json(billing);
    }

    const fixes = runClaimAutoFixEngine(billing, billing.timeline);
    const guard = runClaimGuard(billing, fixes);

    res.json(guard);
  } catch (e) {
    logger.error(`Claim Guard Error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});


// --- SERVE FRONTEND ---
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend-react/build')));
  
  app.get('*', (req, res) => {
    // Only serve index.html for non-API routes
    if (!req.path.startsWith('/api') && !req.path.startsWith('/patients') && !req.path.startsWith('/visits')) {
      res.sendFile(path.resolve(__dirname, '../frontend-react', 'build', 'index.html'));
    }
  });
}

server.listen(process.env.PORT || 5000, () =>
  console.log(`Server & WebSockets running on port ${process.env.PORT || 5000}`)
);
