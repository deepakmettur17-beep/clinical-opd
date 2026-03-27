const { processClinicalCase } = require("../services/clinicalOrchestrator");
const { runHospitalOS } = require("../services/hospitalOrchestrator");
const { analyzeTrends, getSuggestions } = require("../services/followUpEngine");

const evaluateClinicalCase = (req, res) => {
  try {
    const data = req.body; // Expecting { visit, patient, facility } etc.
    const result = processClinicalCase(data);
    
    // Fire WebSocket Critical Alerts
    const isCritical = result.severity === 'Critical' || result.triageLevel === 'RED' || result.respiratoryStatus?.level === 'Severe' || (result.primaryDiagnosis && result.primaryDiagnosis.toLowerCase().includes('shock'));
    const decisions = [result.primaryDiagnosis || "Pending"];
    if (result.severity !== "Stable") decisions.push(`${result.severity || "Unknown"} status`);
    
    const actions = (result.treatments || []).map(t => t.drug).slice(0, 3);
    const isICU = result.primaryDiagnosis && (result.primaryDiagnosis.toLowerCase().includes('icu') || result.respiratoryStatus?.level === 'Severe');
    
    const updateActivePatient = req.app.get('updateActivePatient');
    if (updateActivePatient) {
       updateActivePatient({
          caseId: result.caseId || Date.now().toString(),
          patientName: data.patient?.name || "Unknown Patient",
          diagnosis: result.primaryDiagnosis || "Pending",
          severity: result.severity || "Standard",
          triageLevel: result.triageLevel || "GREEN",
          respiratoryStatus: result.respiratoryStatus || {},
          lastUpdated: Date.now(),
          location: isICU ? "ICU" : "ER",
          alertsActive: isCritical,
          fullData: result
       });
    }

    if (isCritical) {
      const dispatchAlert = req.app.get('dispatchAlert');
      if (dispatchAlert) {
         const alertPayload = {
            caseId: result.caseId || Date.now().toString(),
            patientName: data.patient?.name || "Unknown Patient",
            severity: result.severity || "CRITICAL",
            alertType: result.primaryDiagnosis || "Severe Deterioration",
            timestamp: new Date().toLocaleTimeString(),
            fullData: result,
            acknowledged: false,
            escalated: false
         };
         
         if (isICU) dispatchAlert(['ICU', 'CONSULTANT'], alertPayload);
         else dispatchAlert(['ER', 'CONSULTANT'], alertPayload);
      }
    }

    res.json(result);
  } catch (error) {
    console.error("Error evaluating clinical case:", error);
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
};

const evaluateHospitalOS = async (req, res) => {
  try {
    const data = req.body;
    const result = await runHospitalOS(data);
    res.json(result);
  } catch (error) {
    console.error("Error evaluating hospital OS:", error);
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
};

const getFollowUpAnalysis = async (req, res) => {
  try {
    const { patientId } = req.params;
    const trends = await analyzeTrends(patientId);
    if (!trends) return res.status(404).json({ error: "No finalized visits found for patient" });

    const suggestions = getSuggestions(trends, []); // currentMeds logic can be expanded
    res.json({ trends, suggestions });
  } catch (error) {
    console.error("Error in follow-up analysis:", error);
    res.status(500).json({ error: "Follow-up engine error", message: error.message });
  }
};

module.exports = {
  evaluateClinicalCase,
  evaluateHospitalOS,
  getFollowUpAnalysis
};
