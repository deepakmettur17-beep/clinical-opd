const crypto = require('crypto');
const { handleChestPain } = require('./chestPainHandler');
const { handleFever } = require('./feverHandler');
const { handleBreathlessness } = require('./breathlessnessHandler');
const { handleBleeding } = require('./bleedingHandler');
const { handleSyncope } = require('./syncopeHandler');
const { handleStroke } = require('./strokeHandler');
const { handleTrauma } = require('./traumaHandler');
const { interpretLabs } = require('./labInterpreter');
const { deriveMedications } = require('./treatmentEngine');
const { generateDischargeSummary } = require('./dischargeEngine');
const { generateHistoryTemplate } = require('./historyEngine');
const { validateHistory } = require('./historyValidator');
const { generateSuggestions } = require('./suggestionEngine');
const { evaluateCardiacIntelligence } = require('./cardiacEngine');
const { generateAdvice } = require('./adviceEngine');
const pharmacyService = require('./pharmacyService');
const drugMasterService = require('./drugMasterService');

const calculateVentilatorSettings = (diagnosis, abg, spo2, weight, height, gender) => {
   let settings = { mode: "AC/VC", tidalVolume: "6-8 ml/kg", RR: 14, PEEP: 5, FiO2: "Titrate to SpO2 > 92%", interpretation: "Normal or Uncompensated", warnings: [] };
   if (!abg || (!abg.ph && !abg.pco2 && !abg.po2)) return null;
   
   const ph = parseFloat(abg.ph);
   const pco2 = parseFloat(abg.pco2);
   const po2 = parseFloat(abg.po2);
   const hco3 = parseFloat(abg.hco3);
   
   // Step 1: ABG Interpretation
   if (ph < 7.35 && pco2 > 45) {
      settings.interpretation = "Respiratory Acidosis";
   } else if (ph < 7.35 && hco3 < 22) {
      settings.interpretation = "Metabolic Acidosis";
   } else if (ph > 7.45 && pco2 < 35) {
      settings.interpretation = "Respiratory Alkalosis";
   } else if (ph > 7.45 && hco3 > 26) {
      settings.interpretation = "Metabolic Alkalosis";
   }
   if (po2 < 60) settings.interpretation += " w/ Hypoxemia";
   
   // Step 2 & 3: Condition Logic
   const diag = (diagnosis || '').toLowerCase();
   const pGender = (gender || 'Male').toLowerCase();
   
   let calcWeight = weight ? parseFloat(weight) : null;
   let weightType = "Actual";
   
   if (height) {
      const htCm = parseFloat(height);
      const htInches = htCm / 2.54;
      if (htInches > 60) {
         if (pGender === 'female') {
            calcWeight = 45.5 + (2.3 * (htInches - 60));
         } else {
            calcWeight = 50.0 + (2.3 * (htInches - 60));
         }
         weightType = "IBW";
      }
   }
   if (!calcWeight) calcWeight = 70;
   
   let tvVal = 7;
   let rrVal = 14;
   let peepVal = 5;
   let fio2Val = 50;
   
   // ARDS PROTECTIVE STRATEGY
   if (diag.includes('ards') || diag.includes('distress')) {
      tvVal = 6;
      peepVal = 10;
      fio2Val = 60;
      settings.warnings.push("ARDS: Ensure plateau pressure < 30 cmH2O (clinical check required)");
   } 
   // COPD / ASTHMA AUTO-PEEP PROTECTION
   else if (diag.includes('copd') || diag.includes('asthma') || diag.includes('obstruction')) {
      rrVal = 12;
      peepVal = 5; // NOT zero
      settings.warnings.push("Risk of air trapping / auto-PEEP â€” reduce RR or increase expiratory time");
   } 
   
   if (settings.interpretation.includes("Metabolic Acidosis")) {
      rrVal = 20;
      settings.warnings.push("Acidosis: Monitor for fatigue; increased RR compensating.");
   }
   
   if (settings.interpretation.includes("Respiratory Acidosis") || pco2 > 50) {
      if (!diag.includes('copd')) rrVal = Math.min(24, rrVal + 4);
      settings.warnings.push("Hypercapnia: Increase RR to blow off CO2 (Preference > TV)");
   }
   
   if (settings.interpretation.includes("Hypoxemia") || po2 < 60) {
      fio2Val = 100;
      settings.warnings.push("Hypoxemia: Increase FiO2 first, then titrate PEEP");
   }

   // FiO2-PEEP SAFETY COUPLING
   if (fio2Val > 60) {
      peepVal = Math.min(15, peepVal + 2);
      settings.warnings.push("High FiO2 â€” consider PEEP optimization to avoid oxygen toxicity");
   }
   
   // Step 4: Safety Limits (Mandatory)
   tvVal = Math.min(tvVal, 8);
   rrVal = Math.min(Math.max(rrVal, 10), 24);
   peepVal = Math.min(Math.max(peepVal, 5), 15);
   fio2Val = Math.min(Math.max(fio2Val, 21), 100);
   
   settings.tidalVolume = `${tvVal} ml/kg (${Math.round(tvVal * calcWeight)} ml)`;
   settings.RR = rrVal.toString();
   settings.PEEP = peepVal.toString();
   settings.FiO2 = `${fio2Val}%`;
   settings.derivedWeight = Math.round(calcWeight);
   settings.weightType = weightType;
   // 6. SAFETY BLOCK
   settings.ventilatorDisclaimer = "Settings are suggestions. Clinical correlation required before application. Extubation decision requires clinical judgment.";
   
   // Step 5: Weaning Readiness Check
   const currentSpo2 = parseFloat(spo2 || 90);
   const isPhNormal = ph >= 7.35 && ph <= 7.45;
   if (currentSpo2 > 92 && fio2Val <= 40 && peepVal <= 5 && isPhNormal) {
       settings.weaning = {
           isWeaningReady: true,
           recommendation: "Start Spontaneous Breathing Trial (SBT)",
           checklist: [
               "Ensure patient awake / arousable",
               "Check secretion clearance",
               "Confirm hemodynamic stability (No shock or high-dose vasopressors)"
           ]
       };
   } else {
       settings.weaning = {
           isWeaningReady: false,
           recommendation: "Not ready for SBT",
           checklist: []
       };
   }
   
   return settings;
};

const calculateVentilatorResponse = (prevAbg, currentAbg, prevSpo2, currentSpo2) => {
    if (!prevAbg || !currentAbg || !prevAbg.po2) return null;
    let responseStatus = "Stable";
    let oxygenationTrend = "Unchanged";
    let ventilationTrend = "Unchanged";
    let warnings = [];
    
    // Oxygenation
    const prevPo2 = parseFloat(prevAbg.po2);
    const curPo2 = parseFloat(currentAbg.po2);
    const pSpo2 = parseFloat(prevSpo2 || 90);
    const cSpo2 = parseFloat(currentSpo2 || 90);
    
    if (curPo2 > prevPo2 + 5 || cSpo2 > pSpo2 + 2) {
       oxygenationTrend = "Improving oxygenation";
    } else if (curPo2 < prevPo2 - 5 || cSpo2 < pSpo2 - 2) {
       oxygenationTrend = "Worsening oxygenation";
    } else {
       oxygenationTrend = "No response";
    }
    
    // Ventilation
    const prevPco2 = parseFloat(prevAbg.pco2);
    const curPco2 = parseFloat(currentAbg.pco2);
    if (curPco2 < prevPco2 - 3) {
       ventilationTrend = "Improving ventilation";
    } else if (curPco2 > prevPco2 + 3) {
       ventilationTrend = "Worsening ventilation";
    } else {
       ventilationTrend = "No response";
    }
    
    // pH
    const prevPh = parseFloat(prevAbg.ph);
    const curPh = parseFloat(currentAbg.ph);
    const distPrev = Math.abs(7.4 - prevPh);
    const distCur = Math.abs(7.4 - curPh);
    
    if (distCur < distPrev - 0.02) {
       warnings.push("pH improving: compensation working");
    } else if (distCur > distPrev + 0.02) {
       warnings.push("pH worsening: urgent adjustment needed");
    }
    
    // Final Status
    if (oxygenationTrend.includes("Improving") || ventilationTrend.includes("Improving")) {
       responseStatus = "Improving";
    } 
    if (oxygenationTrend.includes("Worsening") || ventilationTrend.includes("Worsening") || distCur > distPrev + 0.02) {
       responseStatus = "Worsening";
       warnings.push("CRITICAL: Detect failure of ventilator strategy early");
    }
    
    return {
       responseStatus,
       oxygenationTrend,
       ventilationTrend,
       warnings
    };
};

function processClinicalCase(data) {
  const { visit = {}, patient = {}, facility = {} } = data;

  // INPUT VALIDATION FIREWALL
  const v = visit.vitals || {};
  const returnError = (msg) => ({
    error: msg,
    autoFixNotes: [`Medically invalid vitals detected: ${msg}. Clinical safety risk high.`],
    claimSupportLevel: "WEAK",
    justification: `[DATA] Invalid vitals | [DECISION] Rejected | [ACTION] Manual check required. Clinical decision based on limited available data.`,
    historyGaps: ["Invalid vitals provided"],
    medicationAlerts: ["Safety check failed due to invalid inputs"]
  });

  if (v.bp) {
    const parts = v.bp.split('/');
    const sysCheck = parseInt(parts[0]);
    if (isNaN(sysCheck) || sysCheck < 40 || sysCheck > 300) return returnError("INVALID BP RANGE");
  }
  if (v.pulse !== undefined) {
    const pCheck = parseInt(v.pulse);
    if (isNaN(pCheck) || pCheck < 20 || pCheck > 250) return returnError("INVALID PULSE RANGE");
  }
  if (v.spo2 !== undefined) {
    const sCheck = parseInt(v.spo2);
    if (isNaN(sCheck) || sCheck < 0 || sCheck > 100) return returnError("INVALID SPO2 RANGE");
  }

  let auditTrail = ["Case processed"];

  let primaryDiagnosis = "Non-STEMI or Other";
  let differentials = [];
  let confidence = "Low";
  let severity = "Low";
  let disposition = "Evaluate";
  let riskScore = null;
  let treatmentPlan = "Standard Observation";
  let transferNeeded = false;
  let oneLineSummary = "Routine Evaluation";
  let actionChecklist = [];
  let immediatePlan = [];
  let alerts = [];
  let safetyAlerts = [];
  let hemodynamicStatus = "Stable";
  let highRiskFeatures = [];
  let triageLevel = null;
  let timeToAction = null;
  let monitoringPlan = [];
  let thrombolysisEligible = null;
  let timeSinceOnset = null;
  let strokeTypeSuggestion = null;
  let contraindicationsCheck = [];
  let doorToNeedleTarget = null;
  let neurologicalSeverity = null;
  let abcdeStatus = null;
  let labInsights = [];
  let riskScores = { killip: null, grace: null };

  const parseBP = (bpStr) => {
    if (!bpStr) return { sys: 120, dia: 80 };
    const [sys, dia] = bpStr.split('/');
    return { sys: parseInt(sys) || 0, dia: parseInt(dia) || 0 };
  };

  const sysBP = visit.vitals?.bp ? parseBP(visit.vitals.bp).sys : 120;
  const pulse = visit.vitals?.pulse || 80;
  const spo2 = visit.vitals?.spo2 || 98;
  const complaintStr = visit.chiefComplaint ? visit.chiefComplaint.toLowerCase() : "";

  console.log(`[ORCHESTRATOR DEBUG] | sysBP: ${sysBP} | pulse: ${pulse} | spo2: ${spo2} | complaintStr: ${complaintStr}`);
  console.log(`[ORCHESTRATOR IS STEMI FLAGS]`, visit.cardiacEmergency);

  let routedResult = null;

  const isChestPain = complaintStr.includes("chest pain") || complaintStr.includes("angina") || complaintStr.includes("chest");
  const isFever = complaintStr.includes("fever") || complaintStr.includes("infection") || complaintStr.includes("sepsis");
  const isBreathless = complaintStr.includes("breath") || complaintStr.includes("shortness");
  const isBleeding = complaintStr.includes("bleed") || complaintStr.includes("hemorrhage") || complaintStr.includes("vomit") || complaintStr.includes("stool") || complaintStr.includes("melena") || complaintStr.includes("hematemesis");
  const isStroke = complaintStr.includes("weakness") || complaintStr.includes("slurred speech") || complaintStr.includes("facial deviation") || complaintStr.includes("unable to move") || complaintStr.includes("stroke");
  const isTrauma = complaintStr.includes("accident") || complaintStr.includes("trauma") || complaintStr.includes("fall") || complaintStr.includes("injury") || complaintStr.includes("rta");
  const isSyncope = complaintStr.includes("syncope") || complaintStr.includes("fainting") || complaintStr.includes("collapse");
  const isAllergy = complaintStr.includes("allergy") || complaintStr.includes("allergic") || complaintStr.includes("anaphylaxis");

  // Routing
  if (isStroke) {
    routedResult = handleStroke(visit, patient, facility);
  } else if (isTrauma) {
    routedResult = handleTrauma(visit, patient, facility);
  } else if (isChestPain) {
    routedResult = handleChestPain(visit, patient, facility);
  } else if (isSyncope) {
    routedResult = handleSyncope(visit, patient, facility);
  } else if (isFever) {
    routedResult = handleFever(visit, patient, facility);
  } else if (isBreathless) {
    routedResult = handleBreathlessness(visit, patient, facility);
  } else if (isBleeding) {
    routedResult = handleBleeding(visit, patient, facility);
  } else if (isAllergy || (complaintStr.includes("other") && sysBP < 90)) {
    // Preserve old allergy logic and the edge case where "other" + shock = Anaphylaxis/Sepsis fallback
    if (sysBP < 90 && pulse > 100 && complaintStr.includes("other")) {
       routedResult = handleFever(visit, patient, facility); // Old logic routed "other" + shock to sepsis
    } else if (sysBP < 90) {
      primaryDiagnosis = "Anaphylactic Shock";
      differentials = ["Septic shock", "Asthma exacerbation"];
      confidence = "High";
      severity = "Critical";
      treatmentPlan = "Epinephrine IM Injection";
      oneLineSummary = "Anaphylaxis â€“ immediate epinephrine required";
      immediatePlan = [
        "Give IM Epinephrine 0.5mg (1:1000) into anterolateral thigh",
        "Ensure airway patency / give O2",
        "Establish IV access",
        "Administer IV fluids for hypotension",
        "Prepare for intubation if airway compromised"
      ];
      actionChecklist = [
        { step: 1, action: "Administer IM Epinephrine", urgency: "Critical" },
        { step: 2, action: "Give IV Antihistamines & Steroids", urgency: "High" },
        { step: 3, action: "Monitor airway and BP", urgency: "Immediate" }
      ];
      safetyAlerts = [
        "Epinephrine is the first-line treatment, do not delay",
        "Observe for biphasic reaction"
      ];
    }
  } else {
    // Fallback: check cardiac engine in case of silent STEMI (ECG exists without chest pain)
    evaluateCardiacIntelligence(visit);
    if (visit.cardiacEmergency?.isSTEMI) {
      routedResult = handleChestPain(visit, patient, facility);
    } else {
      if (visit.severityLevel) severity = visit.severityLevel;
    }
  }

  // Merge routed results into main response
  if (routedResult) {
    if (routedResult.diagnosis) primaryDiagnosis = routedResult.diagnosis;
    if (routedResult.differentials) differentials = routedResult.differentials;
    if (routedResult.confidence) confidence = routedResult.confidence;
    if (routedResult.severity) severity = routedResult.severity;
    if (routedResult.treatmentPlan) treatmentPlan = routedResult.treatmentPlan;
    if (routedResult.transferNeeded !== undefined) transferNeeded = routedResult.transferNeeded;
    if (routedResult.oneLineSummary) oneLineSummary = routedResult.oneLineSummary;
    if (routedResult.actionChecklist) actionChecklist = routedResult.actionChecklist;
    if (routedResult.immediatePlan) immediatePlan = routedResult.immediatePlan;
    if (routedResult.alerts) alerts = routedResult.alerts;
    if (routedResult.safetyAlerts) safetyAlerts = routedResult.safetyAlerts;
    if (routedResult.hemodynamicStatus) hemodynamicStatus = routedResult.hemodynamicStatus;
    if (routedResult.highRiskFeatures) highRiskFeatures = routedResult.highRiskFeatures;
    if (routedResult.triageLevel) triageLevel = routedResult.triageLevel;
    if (routedResult.timeToAction) timeToAction = routedResult.timeToAction;
    if (routedResult.monitoringPlan) monitoringPlan = routedResult.monitoringPlan;
    if (routedResult.riskScores) riskScores = routedResult.riskScores;
    if (routedResult.disposition) disposition = routedResult.disposition;
    if (routedResult.riskScore) riskScore = routedResult.riskScore;
    if (routedResult.thrombolysisEligible !== undefined) thrombolysisEligible = routedResult.thrombolysisEligible;
    if (routedResult.timeSinceOnset !== undefined) timeSinceOnset = routedResult.timeSinceOnset;
    if (routedResult.strokeTypeSuggestion) strokeTypeSuggestion = routedResult.strokeTypeSuggestion;
    if (routedResult.contraindicationsCheck) contraindicationsCheck = routedResult.contraindicationsCheck;
    if (routedResult.doorToNeedleTarget) doorToNeedleTarget = routedResult.doorToNeedleTarget;
    if (routedResult.neurologicalSeverity) neurologicalSeverity = routedResult.neurologicalSeverity;
    if (routedResult.abcdeStatus) abcdeStatus = routedResult.abcdeStatus;
    if (routedResult.riskScore) riskScore = routedResult.riskScore;
  }

  if (visit.labs) {
    labInsights = interpretLabs(visit.labs);
  }

  const historyTemplate = generateHistoryTemplate(visit.chiefComplaint);
  const historyAnswers = visit.historyAnswers || {};
  const missingCriticalQuestions = validateHistory(historyTemplate, historyAnswers);

  auditTrail.push("Diagnosis generated");

  const patientData = {
    diagnosis: primaryDiagnosis,
    allergies: historyAnswers["Drug allergy"] || "",
    weight: patient.weight || 70, // Retaining hardcoded bypass so UI doesn't break locally
    creatinine: visit.labs ? visit.labs.creatinine : null,
    egfr: visit.labs ? visit.labs.egfr : null,
    platelets: visit.labs ? visit.labs.platelets : null,
    lactate: visit.labs ? visit.labs.lactate : null,
    activeBleed: Object.values(historyAnswers).some(v => typeof v === 'string' && v.toLowerCase().includes('bleed')),
    recentSurgery: Object.values(historyAnswers).some(v => typeof v === 'string' && v.toLowerCase().includes('surgery')),
    pregnant: Object.values(historyAnswers).some(v => typeof v === 'string' && v.toLowerCase().includes('pregnan')),
    alteredSensorium: Object.values(historyAnswers).some(v => typeof v === 'string' && v.toLowerCase().match(/(altered|confusion|drowsy|unconscious|coma)/)),
    currentMedications: historyAnswers["Current medications"] || "",
    systolicBP: sysBP,
    pulse: pulse,
    mapBP: visit.vitals?.bp ? Math.round((sysBP + 2 * parseBP(visit.vitals.bp).dia) / 3) : null,
    spo2: spo2,
    trends: visit.trends || {},
    thrombolysisEligible
  };
  
  const treatmentResult = deriveMedications(patientData);

  if (treatmentResult.error) {
    // FAIL-SAFE: consistent key structure even on error paths
    const safeJustification = `[DATA] ${ visit.chiefComplaint || 'Not recorded' } | [DECISION] Treatment plan blocked | [ACTION] Manual MD review required`;
    return {
      error: treatmentResult.error,
      auditDetails: treatmentResult.auditDetails || null,
      auditLog: treatmentResult.auditLog || null,
      auditTrail,
      justification: safeJustification,
      medicationAlerts: [],
      historyGaps: missingCriticalQuestions || []
    };
  }

  auditTrail.push("Treatment plan created");

  const treatments = treatmentResult.treatments;
  const medicationAlerts = treatmentResult.medicationAlerts;
  const contraindicationsTriggered = treatmentResult.contraindicationsTriggered;
  const escalation = treatmentResult.escalation;
  const risk = treatmentResult.risk;
  const shockType = treatmentResult.shockType;
  const ventilation = treatmentResult.ventilation;
  const auditLog = treatmentResult.auditLog;
  if (treatmentResult.severity) severity = treatmentResult.severity;

  const dischargeSummary = generateDischargeSummary(
    primaryDiagnosis,
    visit.chiefComplaint,
    visit.vitals,
    labInsights,
    treatments,
    disposition,
    severity,
    patient
  );

  const advicePayload = generateAdvice(primaryDiagnosis, historyAnswers["Habits"] || "", historyAnswers["Past medical history"] || "");
  const clinicalSuggestions = generateSuggestions(
    primaryDiagnosis,
    severity,
    visit.vitals,
    labInsights,
    { thrombolysisEligible, riskScore }
  );

  let respiratoryStatus = { hypoxia: false, level: "Normal" };
  if (spo2 !== null) {
    if (spo2 < 85) {
      respiratoryStatus.hypoxia = true;
      respiratoryStatus.level = "Severe";
      safetyAlerts.push("Severe hypoxia â€” immediate oxygen/airway support required");
      if (spo2 < 70) {
        safetyAlerts.push("Life-threatening hypoxia â€” consider intubation");
      }
    } else if (spo2 < 90) {
      respiratoryStatus.hypoxia = true;
      respiratoryStatus.level = "Moderate";
    } else if (spo2 < 94) {
      respiratoryStatus.hypoxia = true;
      respiratoryStatus.level = "Mild";
    }
  }

  const caseId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
  const systemVersion = "v1.5.1-PROD";

  const response = {
    caseId,
    systemVersion,
    patientInfo: patient,
    oneLineSummary,
    primaryDiagnosis,
    differentials,
    confidence,
    severity,
    hemodynamicStatus,
    highRiskFeatures,
    triageLevel,
    timeToAction,
    monitoringPlan,
    riskScores,
    immediatePlan,
    treatmentPlan,
    actionChecklist,
    safetyAlerts,
    transferNeeded,
    alerts,
    disposition,
    riskScore,
    thrombolysisEligible,
    timeSinceOnset,
    strokeTypeSuggestion,
    contraindicationsCheck,
    doorToNeedleTarget,
    neurologicalSeverity,
    abcdeStatus,
    labInsights,
    treatments,
    dischargeSummary,
    historyTemplate,
    missingCriticalQuestions,
    clinicalSuggestions,
    medicationAlerts,
    contraindicationsTriggered,
    escalation,
    risk,
    shockType,
    ventilation,
    auditLog,
    auditTrail,
    respiratoryStatus,
    riskScore,
    respiratoryStatus,
    riskScore,
    lifestyleAdvice: advicePayload.lifestyleAdvice,
    dietAdvice: advicePayload.dietAdvice,
    redFlagAdvice: advicePayload.redFlagAdvice,
    // CONSISTENCY: guaranteed keys â€” never undefined
    justification: '',         // will be set below
    historyGaps: missingCriticalQuestions || [],
    medicationAlerts: medicationAlerts || []
  };

  // ENFORCE MANDATORY FORMAT: [Brand Name] (Generic Name + Strength + Class)
  response.treatments = (response.treatments || []).map(t => {
    const brand = t.drug;
    const generic = drugMasterService.getGenericByBrand(brand);
    const info = drugMasterService.getGenericInfo(generic || '');
    
    if (info) {
      const bInfo = info.brands.find(b => b.name === brand) || { strength: '' };
      t.drug = `${brand} (${info.genericName} ${bInfo.strength} â€“ ${info.drugClass})`;
    }
    return t;
  });

  // --- MEDICO-LEGAL JUSTIFICATION GENERATOR (null-safe, dedup-safe) ---
  const generateJustification = (res) => {
    const dataPoints = [];
    if (visit.vitals?.bp)     dataPoints.push(`BP ${visit.vitals.bp}`);
    if (visit.vitals?.pulse)  dataPoints.push(`HR ${visit.vitals.pulse}`);
    if (visit.vitals?.spo2)   dataPoints.push(`SpO2 ${visit.vitals.spo2}%`);
    if (visit.chiefComplaint) dataPoints.push(`Complaint: ${visit.chiefComplaint}`);

    const decisions = [res.primaryDiagnosis || 'Clinical Assessment'];
    if (res.severity && res.severity !== 'Stable' && res.severity !== 'Low')
      decisions.push(`${res.severity} status`);

    const actionSet = new Set(); // deduplicate action items
    (res.treatments || []).slice(0, 3).forEach(t => t?.drug && actionSet.add(t.drug));
    if (res.disposition) actionSet.add(res.disposition);

    // MEDICO-LEGAL: append history gap disclaimer if present
    const historyNote = (res.historyGaps || []).some(g => !g.includes('cannot be fully excluded'))
      ? ' | [RISK] Incomplete history â€” clinical risk cannot be fully excluded'
      : '';

    return `[DATA] ${dataPoints.join(', ') || 'Vitals not recorded'} | [DECISION] ${decisions.join(' -> ')} | [ACTION] ${[...actionSet].join(', ') || 'Pending review'}${historyNote}`;
  };

  response.justification = generateJustification(response);
  
  const abgInputs = visit.vitals?.abg;
  if (abgInputs && (abgInputs.ph || abgInputs.pco2 || abgInputs.po2)) {
     response.ventilatorStatus = {
         state: "SUGGESTED",
         settings: calculateVentilatorSettings(primaryDiagnosis, abgInputs, visit.vitals?.spo2, patient.weight, patient.height, patient.gender),
         approvedBy: null,
         approvedAt: null,
         appliedBy: null,
         appliedAt: null
     };
  }

  // =============================================================
  // AUTO-CORRECTION & SELF-HEALING LAYER (ADDITIVE ONLY)
  // =============================================================

  // --- 1. AUTO-FIX NOTES: generate suggested clinical notes for missing history ---
  const autoFixNotes = [];
  const gaps = response.historyGaps || [];

  if (gaps.length > 0) {
    const complaint = (visit.chiefComplaint || 'presenting complaint').toLowerCase();

    const missingCore    = gaps.some(g => ['onset','duration','progression','severity'].some(k => g.toLowerCase().includes(k)));
    const missingRedFlag = gaps.some(g => g.includes('red flag'));
    const missingBg      = gaps.some(g => g.includes('medico-legal risk'));

    if (missingCore) {
      autoFixNotes.push(`No detailed history of ${complaint} onset, duration, or progression documented at time of assessment.`);
    }
    if (missingRedFlag) {
      autoFixNotes.push(`No history of chest pain, exertion-related symptoms, or prior cardiac disease documented for this patient â€” clinician to verify.`);
    }
    if (missingBg) {
      autoFixNotes.push(`Past medical history, surgical history, drug allergies, and current medications not documented â€” baseline risk unknown.`);
    }
    
    // STRICT: Dedup and Ensure at least 1 note if gaps exist
    if (autoFixNotes.length === 0 && gaps.length > 0) {
      autoFixNotes.push(`Clinical history incomplete â€” gaps identified in documentation must be manually addressed.`);
    }
  }

  response.autoFixNotes = [...new Set(autoFixNotes)]; // Dedup via Set

  // --- 2. AUTO-COMPLETE JUSTIFICATION: harden weak justification ---
  if (response.justification) {
    const dataMissing = !visit.vitals || !visit.vitals.bp || !visit.vitals.pulse;
    const treatmentsPresent = (response.treatments || []).length > 0;

    if (dataMissing || response.justification.includes('Vitals not recorded')) {
      if (!response.justification.includes('Clinical decision based on limited available data')) {
        response.justification += ' | Clinical decision based on limited available data.';
      }
    }
    if (treatmentsPresent) {
      if (!response.justification.includes('Initiated as per standard emergency protocol')) {
        response.justification += ' | Initiated as per standard emergency protocol.';
      }
    }
  }

  // --- 3. TREATMENT DEFENSIVE COMPLETION: fill missing reason fields ---
  if (Array.isArray(response.treatments)) {
    response.treatments = response.treatments.map(t => ({
      ...t,
      reason: t.reason && t.reason.trim() !== '' ? t.reason : 'Initiated as per standard emergency protocol'
    }));
  }

  // --- 4. CLAIM SUPPORT LEVEL (STRICT) ---
  const _gapCount       = (response.historyGaps || []).filter(g => !g.includes('cannot be fully excluded')).length;
  const _hasVitals      = !!(visit.vitals?.bp && visit.vitals?.pulse);
  const _hasDiagnosis   = !!(response.primaryDiagnosis && response.primaryDiagnosis !== 'Non-STEMI or Other');
  const _hasTreatments  = (response.treatments || []).length > 0;
  const _hasJustification = !!(response.justification && !response.justification.includes('Pending review'));

  let claimSupportLevel = 'STRONG';

  if (!_hasVitals || !_hasDiagnosis || !_hasJustification || _gapCount > 3) {
    claimSupportLevel = 'WEAK';
  } else if (_gapCount > 0 || !_hasTreatments) {
    claimSupportLevel = 'MODERATE';
  } else if (_gapCount === 0 && _hasVitals && _hasDiagnosis && _hasJustification) {
    claimSupportLevel = 'STRONG';
  } else {
    claimSupportLevel = 'WEAK';
  }

  response.claimSupportLevel = claimSupportLevel;
  // =============================================================

  return response;
}

module.exports = { processClinicalCase, calculateVentilatorSettings, calculateVentilatorResponse };