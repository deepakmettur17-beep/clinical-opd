const { runComplianceAnalysis } = require("../services/clinicalExecutionEngine");
const { runTriageEngine } = require("../services/triageEngine");
const { runResourceAllocation } = require('../services/resourceAllocationEngine');
const logger = require('../config/pinoLogger');

const broadcastResourceAllocation = async (io, state) => {
   const { activePatients, clinicalExecutionLogs, lastActionAtMap, isRedisAvailable, redisClient } = state;
   const rClient = isRedisAvailable && redisClient ? redisClient : null;
   const enrichedPatients = [];
   
   try {
      for (const [caseId, pt] of activePatients.entries()) {
         const compliance = await runComplianceAnalysis(caseId, rClient, clinicalExecutionLogs.get(caseId));
         enrichedPatients.push({
            ...pt,
            triageScore: pt.triageScore || 0,
            missedImmediateCount: compliance?.missedSteps?.filter(s => s.category === 'IMMEDIATE').length || 0,
            lastActionAt: lastActionAtMap.get(caseId) || null
         });
      }

      const triageEnriched = runTriageEngine(enrichedPatients); 
      const data = runResourceAllocation(triageEnriched);
      io.to("CONSULTANT").emit("resource_update", data);
   } catch (error) {
      logger.error(`Resource Allocation Broadcast Error: ${error.message}`);
   }
};

module.exports = { broadcastResourceAllocation };
