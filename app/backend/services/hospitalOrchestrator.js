const { processClinicalCase } = require('./clinicalOrchestrator');
const { GlobalLogger } = require('./auditLogger');
const { logError } = require('./errorLogger');

async function executePipeline(payload) {
  // 2. IDEMPOTENCY + REQUEST DEDUP
  if (payload.requestId && GlobalLogger.isDuplicate(payload.requestId)) {
    return GlobalLogger.getCached(payload.requestId);
  }

  // 8 & 9. SAFE MODE + INTEGRITY
  if (!GlobalLogger.verifyChainIntegrity() || GlobalLogger.globalSafeMode) {
    return {
      status: "SAFE_MODE",
      message: "System delay â€” follow emergency protocol manually",
      fallbackPlan: [
        "Stabilize airway, breathing, circulation",
        "Call senior consultant immediately"
      ]
    };
  }

  const { hospitalResources, patients, requestId } = payload;
  let { icuBeds, ventilators } = hospitalResources || { icuBeds: 0, ventilators: 0 };
  
  const hospitalState = {
    totalPatients: patients ? patients.length : 0,
    icuBedsAvailable: icuBeds,
    ventilatorsAvailable: ventilators
  };

  let triage = [];
  let alerts = [];

  if (!patients || patients.length === 0) {
    alerts.push("NO PATIENTS IN QUEUE");
    return { systemVersion: "v1.5.0-PROD", requestId, hospitalState, triage, alerts };
  }

  try {
    for (const p of patients) {
      // CDSS Execution
      const cdssOutput = processClinicalCase(p.payload);
      if (cdssOutput.error && cdssOutput.error.includes("INVALID INPUT")) {
         throw new Error("INVALID INPUT â€” REJECTED");
      }
      if (cdssOutput.error && cdssOutput.error.includes("SAFE MODE")) {
         throw new Error("SAFE_MODE");
      }

      let priorityStr = "STABLE";
      let priorityScore = 4;
      
      const severity = cdssOutput.severity ? cdssOutput.severity.toUpperCase() : "";
      const risk = cdssOutput.risk ? cdssOutput.risk.toUpperCase() : "";
      const escalation = cdssOutput.escalation ? cdssOutput.escalation.toUpperCase() : "";
      
      if (severity.includes("CRITICAL") || severity.includes("SHOCK") || escalation.includes("ICU INTERVENTION REQUIRED")) {
        priorityStr = "CRITICAL";
        priorityScore = 1;
      } else if (severity.includes("HIGH RISK") || risk) {
        priorityStr = "HIGH RISK";
        priorityScore = 2;
      } else if (severity.includes("MODERATE") || severity.includes("HIGH")) {
        priorityStr = "MODERATE";
        priorityScore = 3;
      }

      triage.push({
        patientId: p.patientId,
        priority: priorityStr,
        _score: priorityScore,
        cdssOutput: cdssOutput,
        action: "Admit / Treat",
        escalation: cdssOutput.escalation || ""
      });
    }

    triage.sort((a, b) => a._score - b._score);

    let criticalCount = 0;

    for (let t of triage) {
       if (t.priority === "CRITICAL") criticalCount++;

       let pLog = t.cdssOutput.auditLog || { timestamp: new Date().toISOString(), version: "v1.5.0-PROD", engine: "Unknown", decisionTrace: [] };
       pLog.engine = "Hospital OS Layer";
       pLog.timestamp = new Date().toISOString();
       pLog.decisionTrace.push({ step: "Global Triage Engine", result: `System calculated comparative systemic priority as ${t.priority}` });

       let needsIcu = t._score <= 2;
       let needsVent = t.cdssOutput.ventilation && (t.cdssOutput.ventilation.mode.includes("Volume Control") || t.cdssOutput.ventilation.mode.includes("Intubation"));

       if (needsIcu) {
         if (hospitalState.icuBedsAvailable > 0) {
           hospitalState.icuBedsAvailable--;
           t.action = "ADMIT TO ICU";
           pLog.decisionTrace.push({ step: "Resource Allocation", result: `Allocated 1 ICU Bed. Remaining: ${hospitalState.icuBedsAvailable}` });
         } else {
           t.action = "WAITLISTED (ER HOLDING)";
           t.escalation = "NO ICU BED AVAILABLE â€” TRANSFER REQUIRED";
           pLog.decisionTrace.push({ step: "Resource Allocation", result: `ICU Allocation FAILED (0 available). Patient Waitlisted.` });
           if (!alerts.includes("RESOURCE LIMIT BREACHED: ICU BEDS FULL")) alerts.push("RESOURCE LIMIT BREACHED: ICU BEDS FULL");
         }
       } else if (t.priority === "MODERATE" || t.priority === "STABLE") {
         t.action = "ADMIT TO WARD / OBSERVATION";
         pLog.decisionTrace.push({ step: "Resource Allocation", result: `Patient routed to general observation. ICU parameters not met.` });
       }

       if (needsVent) {
         if (hospitalState.ventilatorsAvailable > 0) {
           hospitalState.ventilatorsAvailable--;
           pLog.decisionTrace.push({ step: "Resource Allocation", result: `Allocated 1 Mechanical Ventilator. Remaining: ${hospitalState.ventilatorsAvailable}` });
         } else {
           t.action += " + MANUAL BAG VALVE MASK";
           t.escalation += " | NO VENTILATOR AVAILABLE";
           pLog.decisionTrace.push({ step: "Resource Allocation", result: `Ventilator Allocation FAILED. Manual ventilation engaged.` });
           if (!alerts.includes("RESOURCE LIMIT BREACHED: VENTILATORS EXHAUSTED")) alerts.push("RESOURCE LIMIT BREACHED: VENTILATORS EXHAUSTED");
         }
       }

       t.auditLog = pLog;
       delete t._score;
    }

    if (criticalCount > 1) {
      alerts.push("MULTIPLE CRITICAL PATIENTS - ENACT LOAD BALANCING");
    }

    const finalResponse = {
      systemVersion: "v1.5.0-PROD",
      requestId,
      hospitalState,
      triage,
      alerts
    };

    // ATOMIC COMMIT TO LOGGER
    const auditPointer = await GlobalLogger.appendLog(requestId, finalResponse);
    if (!auditPointer) throw new Error("SAFE_MODE");

    finalResponse.auditLogReference = "Secure System Buffer -> Disk Sync Verified";
    
    GlobalLogger.cacheResult(requestId, finalResponse);
    return finalResponse;

  } catch (err) {
    if (payload?.requestId) logError(payload.requestId, err.message);
    if (err.message.includes("INVALID CLINICAL INPUT")) return { error: "INVALID CLINICAL INPUT â€” CHECK VITALS" };
    return {
      status: "SAFE_MODE",
      message: "System delay â€” follow emergency protocol manually",
      fallbackPlan: [
        "Stabilize airway, breathing, circulation",
        "Call senior consultant immediately"
      ]
    };
  }
}

async function runHospitalOS(payload) {
  // TIMEOUT CONTROL (HARD LIMIT)
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("SYSTEM TIMEOUT â€” SAFE MODE ACTIVATED")), 3000)
  );

  try {
    const result = await Promise.race([
      executePipeline(payload),
      timeoutPromise
    ]);
    return result;
  } catch (error) {
    if (payload.requestId) {
       await GlobalLogger.appendLog(payload.requestId, { error: error.message, layer: "Hospital OS" });
       logError(payload.requestId, error.message);
    } else {
       logError("UNKNOWN", error.message);
    }
    return {
      status: "SAFE_MODE",
      message: "System delay â€” follow emergency protocol manually",
      fallbackPlan: [
        "Stabilize airway, breathing, circulation",
        "Call senior consultant immediately"
      ]
    };
  }
}

module.exports = { runHospitalOS };