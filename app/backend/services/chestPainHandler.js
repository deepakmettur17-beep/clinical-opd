const { evaluateCardiacIntelligence } = require('./cardiacEngine');
const { calculateDTB } = require('./dtbEngine');
const { calculateGraceScore } = require('./graceEngine');
const { applyKillipMortality } = require('./killipEngine');
const { generateTransferLetter } = require('./transferEngine');

function handleChestPain(visit, patient, facility) {
  let diagnosis = "Non-STEMI or Other";
  let differentials = [];
  let confidence = "Low";
  let severity = "Low";
  let treatmentPlan = "Standard Observation";
  let transferNeeded = false;
  let oneLineSummary = "Routine Evaluation";
  let actionChecklist = [];
  let immediatePlan = [];
  let alerts = [];
  let safetyAlerts = [];
  let riskScores = { killip: null, grace: null };

  evaluateCardiacIntelligence(visit);

  if (visit.cardiacEmergency?.isSTEMI) {
    diagnosis = "STEMI";
    differentials = ["NSTEMI", "Aortic dissection"];
    confidence = "High";
    severity = visit.severityLevel || "Critical";
    treatmentPlan = visit.admissionPlan || "Immediate PCI";

    if (visit.ruleFlags && visit.ruleFlags.length > 0) {
      alerts.push(...visit.ruleFlags);
    }

    safetyAlerts = [
      "Do not delay PCI beyond guideline window",
      "Check contraindications for thrombolysis if PCI delayed",
      "Monitor for arrhythmias continuously"
    ];

    immediatePlan = [
      "Give aspirin 325 mg stat",
      "Start oxygen if SpO2 < 94%",
      "Establish IV access",
      "Send blood for troponin, CBC, RFT",
      "Prepare for PCI or transfer immediately"
    ];

    applyKillipMortality(visit);
    riskScores.killip = {
      class: visit.killipClass,
      mortalityRisk: visit.mortalityRiskEstimate || visit.killipMortalityPercent
    };

    riskScores.grace = calculateGraceScore(visit, patient);

    if (visit.cardiacTimestamps) {
      visit.doorTime = visit.doorTime || visit.cardiacTimestamps.erArrivalTime;
      visit.balloonTime = visit.balloonTime || visit.cardiacTimestamps.balloonInflationTime;
    }
    calculateDTB(visit);
    
    if (visit.dtbPerformanceFlag) {
      alerts.push(`Door-to-Balloon: ${visit.dtbPerformanceFlag}`);
    }
    if (visit.pciDelayAlert) {
      alerts.push(`PCI ALERT: ${visit.pciDelayLevel}`);
    }

    const hasCathLab = facility.hasCathLab === true;
    if (!hasCathLab) {
      transferNeeded = true;
      treatmentPlan = "Transfer for Primary PCI";
      oneLineSummary = "STEMI â€“ urgent PCI required, prepare for transfer";
      
      actionChecklist = [
        { step: 1, action: "Give aspirin 325 mg immediately", urgency: "Immediate" },
        { step: 2, action: "Start heparin", urgency: "High" },
        { step: 3, action: "Prepare transfer", urgency: "Critical" }
      ];

      visit.autoReferralReason = visit.autoReferralReason || "STEMI confirmed. No Cath Lab at facility. Immediate transfer for PCI required.";
      generateTransferLetter(visit, patient, facility);
      alerts.push("Transfer recommended: Transfer letter generated.");
    } else {
      transferNeeded = false;
      treatmentPlan = "Immediate Primary PCI (Onsite)";
      oneLineSummary = "STEMI â€“ urgent PCI required (Local Cath Lab)";

      actionChecklist = [
        { step: 1, action: "Give aspirin 325 mg immediately", urgency: "Immediate" },
        { step: 2, action: "Start heparin", urgency: "High" },
        { step: 3, action: "Activate cath lab", urgency: "Critical" }
      ];
    }
  } else if (visit.severityLevel) {
    severity = visit.severityLevel;
  }

  return {
    diagnosis,
    oneLineSummary,
    immediatePlan,
    actionChecklist,
    safetyAlerts,
    confidence,
    differentials,
    severity,
    treatmentPlan,
    transferNeeded,
    alerts,
    riskScores
  };
}

module.exports = { handleChestPain };