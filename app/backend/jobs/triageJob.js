const { runComplianceAnalysis } = require("../services/clinicalExecutionEngine");
const { runTriageEngine } = require("../services/triageEngine");
const logger = require('../config/pinoLogger');

const broadcastTriage = async (io, state) => {
   const { activePatients, clinicalExecutionLogs, lastActionAtMap, isRedisAvailable, redisClient } = state;
   const patients = [];
   const rClient = isRedisAvailable && redisClient ? redisClient : null;

   try {
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
   } catch (error) {
      logger.error(`Triage Broadcast Error: ${error.message}`);
   }
};

module.exports = { broadcastTriage };
