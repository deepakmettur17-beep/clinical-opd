const fs = require('fs');
const pharmacyService = require('./pharmacyService');
const drugMasterService = require('./drugMasterService');

function isAllergic(drug, allergiesStr) {
  if (!allergiesStr) return false;
  const drugLower = drug.toLowerCase();
  const patientAlgs = allergiesStr.split(',').map(s => s.trim().toLowerCase());
  return patientAlgs.some(alg => drugLower.includes(alg) || alg.includes(drugLower.split('-')[0].split(' ')[0]));
}

function checkContraindications(drug, category, diagUpper, activeBleed, recentSurgery, platelets, pregnant, egfr, creatinine) {
  let contra = null;
  if (category === "anticoagulants" || category === "antiplatelets" || category === "thrombolytics") {
    if (activeBleed) contra = "Active Bleeding (Absolute Contraindication)";
    if (recentSurgery) contra = "Recent Surgery";
    if (platelets !== null && platelets < 30000) contra = "Severe Thrombocytopenia (Platelets < 30k)";
    if (platelets !== null && platelets < 50000 && category !== "antiplatelets") contra = "Thrombocytopenia (Platelets < 50k)";
    if (pregnant && category !== "anticoagulants") contra = "Pregnancy (Risk)"; 
  }
  if (category === "nsaids" || drug === "Piperacillin-Tazobactam" || drug === "Meropenem") {
    if (egfr !== null && egfr < 30) contra = "Severe Renal Failure (eGFR <30)";
    if (creatinine !== null && creatinine > 2.0) contra = "Acute Renal Impairment (Cr > 2.0)";
  }
  return contra;
}

// -----------------------------------
// AUDIT ENGINE (SECOND LAYER)
// -----------------------------------
function auditEngine(treatments, diagUpper, medicationAlerts, contraindicationsTriggered, allergiesStr, decisionTrace) {
  let issues = [];

  for (const t of treatments) {
    if (isAllergic(t.drug, allergiesStr)) {
      const msg = `CRITICAL SAFETY: Allergen present in final treatments -> ${t.drug}`;
      if (!issues.includes(msg)) issues.push(msg);
    }
  }

  const hasFluid = treatments.some(t => t.drug.includes("IV Fluids"));
  const hasAbx = treatments.some(t => t.category === "antibiotics");
  const hasVaso = treatments.some(t => t.drug === "Noradrenaline" || t.drug === "Adrenaline" || t.category === "vasopressors");
  const hasAntiplatelet = treatments.some(t => t.category === "antiplatelets");

  if (diagUpper.includes("SEPSIS") || diagUpper.includes("SEPTIC")) {
    if (!hasFluid && !contraindicationsTriggered.some(c => c.includes("IV Fluids") || c.includes("WEIGHT") || c.includes("CONTRAINDICATION"))) {
      issues.push("Sepsis protocol incomplete: Missing IV Fluids");
    }
    if (!hasAbx && !contraindicationsTriggered.some(c => c.includes("Renal") || c.includes("ALLERGY") || c.includes("CONTRAINDICATION"))) {
      issues.push("Sepsis protocol incomplete: Missing Antibiotics");
    }
  }
  
  if (diagUpper.includes("STEMI")) {
    if (!hasAntiplatelet && !contraindicationsTriggered.some(c => c.includes("Bleed") || c.includes("CRITICAL PROTOCOL CONFLICT"))) {
      issues.push("STEMI protocol incomplete: Missing Antiplatelet");
    }
  }

  if (hasVaso && !hasFluid && treatments.length > 0) {
    issues.push("Temporal Dependency Violated: Vasopressors MUST NOT precede fluids");
  }

  for (let i = 0; i < treatments.length - 1; i++) {
    if (treatments[i].priority > treatments[i+1].priority) {
      issues.push("Priority Sequencing Violated: Lower priority treatment precedes higher priority");
    }
  }

  const hasInvalidDose = treatments.some(t => !t.dose || t.dose.includes("undefined") || t.dose.includes("NaN") || t.dose.includes("null"));
  if (hasInvalidDose) issues.push("Dosing Error: Missing or undefined dose detected");

  if (treatments.length > 5) issues.push("Hard Limit Exceeded: More than 5 treatments generated");

  if (issues.length > 0) {
    decisionTrace.push({ step: "Audit Engine Layer", result: `FAILED: ${issues.join(" | ")}` });
    return { status: "REJECTED", issues };
  }
  
  decisionTrace.push({ step: "Audit Engine Layer", result: "PASSED: All safety and sequencing parameters validated." });
  return { status: "APPROVED" };
}


function deriveMedications(patientData, formulary) {
  let treatments = [];
  let medicationAlerts = [];
  let contraindicationsTriggered = [];
  let escalation = "";
  let decisionTrace = [];

  const logTrace = (step, result) => decisionTrace.push({ step, result });

  // PERFORMANCE: cache allergy lookups per request cycle
  const _allergyCache = new Map();
  const cachedIsAllergic = (drug, allergyStr) => {
    const key = `${drug}::${allergyStr}`;
    if (!_allergyCache.has(key)) _allergyCache.set(key, isAllergic(drug, allergyStr));
    return _allergyCache.get(key);
  };

  // DEDUP HELPER: only add alert if not already present
  const addAlert = (msg) => { if (!medicationAlerts.includes(msg)) medicationAlerts.push(msg); };
  const addContra = (msg) => { if (!contraindicationsTriggered.includes(msg)) contraindicationsTriggered.push(msg); };

  logTrace("Data Injection", `Patient data received for diagnosis: ${patientData.diagnosis}`);

  const {
    diagnosis, allergies, weight, creatinine, egfr, platelets,
    activeBleed, recentSurgery, pregnant, alteredSensorium,
    systolicBP, mapBP, pulse, spo2, lactate, thrombolysisEligible,
    trends
  } = patientData;

  if (!diagnosis) {
    logTrace("Fatality Check", "INSUFFICIENT DATA FOR SAFE RECOMMENDATION");
    return { error: "INSUFFICIENT DATA FOR SAFE RECOMMENDATION", auditLog: { timestamp: new Date().toISOString(), version: "2.0", engine: "CDSS Core", decisionTrace } };
  }

  const diagUpper = diagnosis.toUpperCase();
  let severity = "Stable";
  let isCriticalConflict = false;
  let shockType = "";
  let ventilation = null;
  let risk = null;

  const { bpTrend, spo2Trend, lactateTrend } = trends || {};

  // PREDICTIVE ENGINE (EARLY LOGIC)
  if (systolicBP !== null && systolicBP >= 90 && lactateTrend === "rising") {
    risk = "COMPENSATED SHOCK";
  } else if (pulse !== null && pulse > 100 && systolicBP !== null && systolicBP >= 90 && systolicBP <= 100) {
    risk = "COMPENSATED SHOCK";
  }

  if (mapBP !== null && mapBP >= 65 && mapBP <= 70 && bpTrend === "falling") {
    if (lactate !== null && lactate < 2 && lactateTrend === "rising" && pulse !== null && pulse > 100) {
      risk = "EARLY SHOCK";
    }
  }

  if (spo2 !== null && spo2 >= 90 && spo2 <= 94 && spo2Trend === "falling") {
    risk = "IMPENDING RESPIRATORY FAILURE";
  }

  if (risk) {
    severity = "HIGH RISK";
    escalation = "PRE-EMPTIVE ICU INTERVENTION REQUIRED";
    logTrace("Predictive Engine", `Identified early deterioration: ${risk}. Escalated to HIGH RISK.`);
  }

  const hasAnticoagIndication = diagUpper.includes("STEMI") || diagUpper.includes("MYOCARDIAL INFARCTION") || (diagUpper.includes("STROKE") && thrombolysisEligible);

  // SHOCK CLASSIFICATION ENGINE
  if ((systolicBP !== null && systolicBP < 90) || (mapBP !== null && mapBP < 65)) {
    severity = "Shock";
    if (lactate !== null && lactate > 2) {
      shockType = "Septic Shock";
      logTrace("Hemodynamic Engine", `Classified Septic Shock (MAP <65 or SBP <90 w/ Lactate >2)`);
    } else {
      shockType = "Undifferentiated Shock";
      logTrace("Hemodynamic Engine", `Classified Undifferentiated Shock (Lactate <= 2)`);
    }
  }

  // VENTILATION ENGINE
  if (spo2 !== null && spo2 < 90) {
    if (spo2 < 85 || alteredSensorium) {
      ventilation = {
        mode: "Volume Control / SIMV",
        settings: {
          tidalVolume: weight ? `${Math.round(weight * 6)} ml (6 ml/kg)` : "6 ml/kg",
          peep: spo2 < 85 ? "8-10 cm H2O (ARDS Protocol)" : "5 cm H2O",
          fio2: "Titrate to SpO2 > 92%"
        }
      };
      logTrace("Ventilation Engine", `Triggered Mechanical Ventilation (Volume Control). ARDS/Intubation threshold met.`);
    } else {
      ventilation = {
        mode: "Non-invasive Ventilation (BiPAP)",
        settings: {
          ipap: "10 cm H2O",
          epap: "5 cm H2O",
          fio2: "Titrate to SpO2 > 92%"
        }
      };
      logTrace("Ventilation Engine", `Triggered Non-Invasive Ventilation (BiPAP). Moderate hypoxia detected.`);
    }
  }

  // DYNAMIC RISK ESCALATION
  if ((lactate !== null && lactate > 4) || 
      (systolicBP !== null && systolicBP < 80) || 
      (spo2 !== null && spo2 < 85) ||
      (platelets !== null && platelets < 30000) ||
      (activeBleed && hasAnticoagIndication)) {
    severity = "CRITICAL";
    escalation = "IMMEDIATE ICU INTERVENTION REQUIRED";
    logTrace("Severity Engine", `Escalated to CRITICAL status due to overt organ failure or severe risk markers.`);
  }

  // EDGE CASE PRIORITY OVERRIDE
  if (activeBleed && hasAnticoagIndication) {
    severity = "CRITICAL_CONFLICT";
    escalation = "URGENT SPECIALIST INTERVENTION REQUIRED";
    isCriticalConflict = true;
    logTrace("Conflict Resolution", `Critical Protocol Override: Active Bleed merged against Anticoagulant indication. Routine therapies blocked.`);
  }

  const isAvailable = (drug, category) => {
    // 1. Check if it's an exact brand match
    const brandDetails = pharmacyService.getBrandDetails(drug);
    if (brandDetails && brandDetails.stockCount > 0 && brandDetails.isSafeToPrescribe) return true;

    // 2. Check if it's a generic name and has available brands
    const availableBrands = pharmacyService.getAvailableBrands(drug);
    return availableBrands.length > 0;
  };

  const processDrug = (preferred, fallback, category, baseDose, route, reason, priority, isSupportive = false) => {
    if (isCriticalConflict && !isSupportive) {
      contraindicationsTriggered.push(`Standard therapy withheld: ${preferred} due to CRITICAL PROTOCOL CONFLICT (Active Bleed + Anticoagulant Indication)`);
      logTrace("Contraindication Check", `Blocked ${preferred} due to critical protocol conflict.`);
      return;
    }

    if (!isAvailable(preferred, category)) {
      if (fallback && isAvailable(fallback, category)) {
        logTrace("Formulary Check", `Preferred ${preferred} unavailable. Overrode to ${fallback}.`);
        preferred = fallback;
      } else {
        contraindicationsTriggered.push(`Standard therapy withheld: ${preferred} due to FORMULARY UNAVAILABILITY`);
        logTrace("Formulary Check", `Blocked ${preferred} - Missing from hospital formulary.`);
        return;
      }
    }

    if (cachedIsAllergic(preferred, allergies)) {
      addAlert(`CRITICAL: ${preferred} avoided due to allergy`);
      if (fallback && isAvailable(fallback, category) && !cachedIsAllergic(fallback, allergies)) {
        logTrace("Allergy Check", `Allergy to ${preferred}. Substituting with ${fallback}.`);
        preferred = fallback;
        addAlert(`Modified due to documented allergy â€” ${fallback} substituted for original first-line agent`);
      } else {
        addContra(`Standard therapy withheld: ${preferred} due to ALLERGY (No safe substitute)`);
        logTrace("Allergy Check", `Blocked ${preferred} â€” no safe substitute available.`);
        return;
      }
    }

    // --- GENERIC RESOLUTION: resolve preferred to a brand ---
    let finalDrug = preferred;
    const availableBrands = pharmacyService.getAvailableBrands(preferred);
    if (availableBrands.length > 0) {
      finalDrug = availableBrands[0].brand; // Pick first available
      logTrace("Pharmacy Engine", `Resolved generic ${preferred} to brand ${finalDrug} (Stock: ${availableBrands[0].stockCount})`);
    }

    // --- NEW: DRUG CLASS DUPLICATION CHECK ---
    const genericName = drugMasterService.getGenericByBrand(finalDrug);
    if (genericName) {
      const prescribedGenerics = treatments.map(t => drugMasterService.getGenericByBrand(t.drug)).filter(Boolean);
      const classAlert = drugMasterService.checkClassDuplication(prescribedGenerics, genericName);
      if (classAlert) {
         addAlert(classAlert);
         logTrace("Safety Engine", `Blocked ${preferred} due to class duplication: ${classAlert}`);
         return;
      }
    }

    const contra = checkContraindications(preferred, category, diagUpper, activeBleed, recentSurgery, platelets, pregnant, egfr, creatinine);
    if (contra) {
      contraindicationsTriggered.push(`Avoided ${preferred}: ${contra}`);
      if (fallback) {
        if (isAvailable(fallback, category) && !isAllergic(fallback, allergies)) {
          const fbContra = checkContraindications(fallback, category, diagUpper, activeBleed, recentSurgery, platelets, pregnant, egfr, creatinine);
          if (fbContra) {
            contraindicationsTriggered.push(`Avoided fallback ${fallback}: ${fbContra}`);
            contraindicationsTriggered.push(`Standard therapy withheld: ${preferred} due to MULTIPLE CONTRAINDICATIONS`);
            logTrace("Contraindication Check", `Blocked fallback ${fallback} - Multiple absolute blockers active.`);
            return;
          } else {
            logTrace("Contraindication Check", `Contraindication to ${preferred}. Overrode safely to ${fallback}.`);
            preferred = fallback;
          }
        } else {
          contraindicationsTriggered.push(`Standard therapy withheld: ${preferred} due to CONTRAINDICATION (No Safe Fallback)`);
          logTrace("Contraindication Check", `Blocked ${preferred} with no safe fallback trajectory (${contra}).`);
          return;
        }
      } else {
        contraindicationsTriggered.push(`Standard therapy withheld: ${preferred} due to ${contra}`);
        logTrace("Contraindication Check", `Blocked ${preferred} - Extracted absolute contraindication: ${contra}`);
        return;
      }
    }

    let finalDose = baseDose;

    if (finalDrug.includes("IV Fluids")) {
      if (!weight && baseDose.includes("kg")) {
        contraindicationsTriggered.push(`Standard therapy withheld: IV Fluids (Weight-based) due to MISSING WEIGHT DATA`);
        logTrace("Dosing Engine", `Blocked Weight-based IV fluids due to unsafe/missing variable.`);
        return; 
      }
      if (weight && baseDose.includes("kg")) finalDose = `${weight * parseInt(baseDose)} ml`;
    }

    if (finalDrug === "Alteplase") {
      if (!weight) {
        contraindicationsTriggered.push(`Standard therapy withheld: Alteplase due to MISSING WEIGHT`);
        logTrace("Dosing Engine", `Blocked Alteplase specifically due to missing max-dose weight constraint.`);
        return;
      }
      finalDose = `${(weight * 0.9).toFixed(1)} mg (Max 90mg)`;
    }

    if (["Piperacillin-Tazobactam", "Meropenem", "Ceftriaxone"].includes(finalDrug) && egfr !== null && egfr < 50 && egfr >= 30) {
       finalDose = `${baseDose} (Renal Adjusted)`;
    }

    if (!treatments.some(t => t.drug === finalDrug)) {
      treatments.push({ drug: finalDrug, dose: finalDose, route, reason, priority, category });
      logTrace("Treatment Matrix", `Added ${finalDrug} successfully to pipeline.`);
    }
  };

  // MULTI-CONDITION & TEMPORAL SEQUENCING
  if (diagUpper.includes("SEPSIS") || diagUpper.includes("SEPTIC") || diagUpper.includes("INFECTION") || shockType === "Septic Shock") {
    processDrug("IV Fluids (NS/RL)", null, "fluids", "30 ml/kg", "IV", "Fluid resuscitation (SSC Guideline)", 1, true);
    if (severity === "Shock" || severity === "CRITICAL" || severity === "CRITICAL_CONFLICT") {
      processDrug("Noradrenaline", "Adrenaline", "emergency", "0.05 - 0.1 mcg/kg/min", "IV Infusion", "Vasopressor support for persistent shock", 2, true);
    }
    processDrug("Piperacillin-Tazobactam", "Ceftriaxone", "antibiotics", "4.5 g", "IV", "Broad-spectrum coverage", 3, false);
  } 
  else if (diagUpper.includes("STEMI") || diagUpper.includes("MYOCARDIAL INFARCTION")) {
    if (systolicBP !== null && systolicBP < 90) {
      processDrug("IV Fluids (NS/RL)", null, "fluids", "250 ml bolus", "IV", "Supportive care for hypotension", 1, true);
    }
    processDrug("Aspirin", "Clopidogrel", "antiplatelets", "325 mg", "Oral", "Antiplatelet therapy stat", 2, false);
    processDrug("Clopidogrel", "Ticagrelor", "antiplatelets", "300 mg", "Oral", "P2Y12 inhibitor loading", 2, false);
    processDrug("Heparin", "Enoxaparin", "anticoagulants", "5000 IU", "IV", "Initial anticoagulation", 3, false);
  } 
  else if (diagUpper.includes("STROKE")) {
    if (thrombolysisEligible) {
      if (!weight) return { error: "INSUFFICIENT DATA FOR SAFE RECOMMENDATION" }; 
      processDrug("Alteplase", null, "thrombolytics", "0.9 mg/kg", "IV", "Thrombolysis", 2, false);
    } else {
      contraindicationsTriggered.push("Standard therapy withheld: Alteplase due to Eligibility limits (Time Window / Baseline Safety)");
      processDrug("Aspirin", "Clopidogrel", "antiplatelets", "300 mg", "Oral", "Secondary antiplatelet prevention", 3, false);
    }
  } 
  else if (diagUpper.includes("TRAUMA")) {
    processDrug("Oxygen", null, "emergency", "15 L/min", "Inhalation", "Airway/Breathing support", 1, true);
    processDrug("IV Fluids (NS/RL)", null, "fluids", "Titrate to BP", "IV", "Circulation support (ATLS)", 2, true);
    processDrug("Tranexamic Acid", null, "emergency", "1 g over 10 mins", "IV", "Hemorrhage control", 3, false);
  }
  else if (diagUpper.includes("ANAPHYLAXIS")) {
    processDrug("Adrenaline", null, "emergency", "0.5 mg", "IM", "Immediate reversal", 1, true);
    processDrug("Hydrocortisone", null, "emergency", "100 mg", "IV", "Late-phase modulation", 3, false);
  }
  else if (diagUpper.includes("BLEED") || diagUpper.includes("HEMORRHAGE")) {
    processDrug("IV Fluids (NS/RL)", null, "fluids", "Titrate to MAP 65", "IV", "Volume resuscitation", 1, true);
    processDrug("Pantoprazole", null, "gi", "80 mg", "IV", "Acid suppression", 3, false);
  }

  if (treatments.length === 0 && !isCriticalConflict && !ventilation) {
    logTrace("Termination Engine", "Failed - No valid treatments executable. Halting for manual MD override.");
    let alog = { timestamp: new Date().toISOString(), version: "2.0", engine: "CDSS Core", decisionTrace };
    return { error: "INSUFFICIENT DATA FOR SAFE RECOMMENDATION", auditLog: alog };
  }

  // Pre-sort before audit
  treatments.sort((a,b) => a.priority - b.priority);

  // SECOND LAYER: AUDIT ENGINE (REDUNDANCY WRAPPER)
  let auditStatus;
  try {
    auditStatus = auditEngine(treatments, diagUpper, medicationAlerts, contraindicationsTriggered, allergies, decisionTrace);
  } catch (err) {
    logTrace("Redundancy Engine", `Audit Engine crashed. Attempting 1 controlled retry.`);
    try {
      auditStatus = auditEngine(treatments, diagUpper, medicationAlerts, contraindicationsTriggered, allergies, decisionTrace);
    } catch (err2) {
      logTrace("Redundancy Engine", `Audit Engine crashed on retry. Triggering Global Safe Mode.`);
      return { error: "SYSTEM IN SAFE MODE â€” MANUAL REVIEW REQUIRED" };
    }
  }

  let finalAuditLog = {
      timestamp: new Date().toISOString(),
      version: "2.0",
      engine: "CDSS Core + Audit",
      decisionTrace
  };

  if (auditStatus.status === "REJECTED") {
    return { error: "UNSAFE TREATMENT PLAN â€” BLOCKED BY AUDIT ENGINE", auditDetails: auditStatus, auditLog: finalAuditLog };
  }

  // Clean the internal object tags 
  treatments = treatments.map(t => ({ drug: t.drug, dose: t.dose, route: t.route, reason: t.reason, priority: t.priority }));

  return {
    status: auditStatus.status,
    diagnosis,
    severity,
    risk,
    shockType,
    ventilation,
    treatments,
    medicationAlerts,
    contraindicationsTriggered,
    escalation,
    auditLog: finalAuditLog
  };
}

module.exports = { deriveMedications };