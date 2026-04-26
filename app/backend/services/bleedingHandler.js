function handleBleeding(visit, patient, facility) {
  const parseBP = (bpStr) => {
    if (!bpStr) return { sys: 120, dia: 80 };
    const [sys, dia] = bpStr.split('/');
    return { sys: parseInt(sys) || 0, dia: parseInt(dia) || 0 };
  };

  const sysBP = visit.vitals?.bp ? parseBP(visit.vitals.bp).sys : 120;
  const pulse = visit.vitals?.pulse || 80;
  const complaintStr = visit.chiefComplaint ? visit.chiefComplaint.toLowerCase() : "";

  let diagnosis = "Active Bleeding (Undifferentiated)";
  let differentials = [
    { name: "Trauma", priority: "High" },
    { name: "GI Bleed", priority: "Moderate" },
    { name: "Coagulopathy", priority: "Low" }
  ];
  let confidence = "Low";
  let severity = "Moderate";
  let hemodynamicStatus = "Stable";
  let triageLevel = "ORANGE";
  let timeToAction = "Within 1 hour";
  let oneLineSummary = "Suspected GI bleed â€“ requires evaluation and endoscopy";
  let immediatePlan = ["Apply direct pressure if external bleeding", "Establish IV access", "Check CBC and coagulation profile"];
  let actionChecklist = [];
  let safetyAlerts = [];
  let alerts = [];
  let highRiskFeatures = [];
  let monitoringPlan = [
    "Check BP every 5 minutes",
    "Monitor urine output",
    "Continuous pulse oximetry"
  ];
  
  if (complaintStr.includes("alcohol") || complaintStr.includes("liver") || complaintStr.includes("cirrhosis")) {
    highRiskFeatures.push("Possible variceal bleed");
  }

  if (complaintStr.includes("vomiting blood") || complaintStr.includes("hematemesis") || complaintStr.includes("black stool") || complaintStr.includes("melena")) {
    diagnosis = "Upper GI Bleed";
    differentials = [
      { name: "Variceal bleed", priority: "High" },
      { name: "Peptic ulcer", priority: "Moderate" },
      { name: "Gastritis", priority: "Low" }
    ];
    confidence = "High";
    immediatePlan = [
      "Establish 2 large bore IVs",
      "Type and crossmatch blood",
      "Start IV PPI (e.g., Pantoprazole)",
      "Consider Octreotide if variceal suspected",
      "Keep NPO and consult Gastroenterology"
    ];
    actionChecklist = [
      { step: 1, action: "Administer IV Fluids or Blood", urgency: "High" },
      { step: 2, action: "GI Consult for Endoscopy", urgency: "High" }
    ];
    safetyAlerts = ["Do not delay transfusion if hemodynamically unstable", "Risk of aspiration, protect airway"];
  } else if (complaintStr.includes("fresh bleeding") || complaintStr.includes("rectal bleeding")) {
    diagnosis = "Lower GI Bleed";
    differentials = [
      { name: "Diverticular bleed", priority: "High" },
      { name: "Hemorrhoids", priority: "Moderate" },
      { name: "Colitis", priority: "Low" }
    ];
    confidence = "High";
    immediatePlan = [
      "Establish large bore IV access",
      "Type and crossmatch blood",
      "Monitor closely for significant drop in hemoglobin",
      "Keep NPO and consult Gastroenterology"
    ];
    actionChecklist = [
      { step: 1, action: "Serial Hemoglobin Monitoring", urgency: "Normal" },
      { step: 2, action: "Consider colonoscopy when stable", urgency: "Normal" }
    ];
    safetyAlerts = ["Bleeding may be intermittent, monitor closely for shock"];
  }

  if (sysBP < 90 || pulse > 100) {
    severity = "Critical";
    hemodynamicStatus = "Unstable";
    triageLevel = "RED";
    timeToAction = "Immediate";
    oneLineSummary = "Massive GI bleed with shock â€“ immediate resuscitation required";
    immediatePlan = [
      "Airway protection",
      "2 large-bore IV lines",
      "IV fluids / blood transfusion",
      "Labs (CBC, crossmatch, coagulation)",
      "Urgent endoscopy consult"
    ];
    safetyAlerts.unshift("Patient is hemodynamically unstable, activate massive transfusion protocol if shock worsens.");
  }

  alerts.push("Do not delay resuscitation for endoscopy");
  
  immediatePlan = immediatePlan.slice(0, 5);

  return {
    diagnosis,
    severity,
    oneLineSummary,
    immediatePlan,
    actionChecklist,
    safetyAlerts,
    confidence,
    differentials,
    hemodynamicStatus,
    highRiskFeatures,
    alerts,
    triageLevel,
    timeToAction,
    monitoringPlan
  };
}

module.exports = { handleBleeding };