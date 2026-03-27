/**
 * Clinical Report Interpretation Engine (v8.0 - Communication Grade)
 * Uses high-yield keyword mapping and rule-based template generation.
 */

const DICTIONARY = {
    "infarct": { 
        condition: "Ischemic Stroke", 
        meaning: "Reduced blood supply to brain tissue causing cell death.", 
        simple: "A blockage in a blood vessel in the brain.", 
        severity: "CRITICAL", 
        urgency: "IMMEDIATE",
        probableCause: "Clot or vascular blockage",
        prognosis: "Serious, requires immediate intensive care",
        advice: "Consult a neurologist immediately. If weakness, speech difficulty, or confusion occurs, go to emergency.",
        correlations: ["weakness", "speech", "confusion", "numbness", "vision"],
        actions: ["CT brain / MRI", "Check thrombolysis window", "Admit to ICU/Stroke Unit"],
        followUp: ["Neurologist review (1 week)", "Stroke rehab/Physiotherapy", "Long-term medication"],
        medAdjust: ["Start Aspirin/Atorvastatin", "BP control escalation"],
        monitoring: ["Daily BP", "Weakness or speech changes"],
        careTasks: [
            { id: "task_stroke_img", task: "MRI / CT Brain", due: "Immediate", type: "imaging", hook: "book_lab_test" },
            { id: "task_stroke_adm", task: "Stroke Unit Admission", due: "Immediate", type: "clinical", hook: "book_appointment" }
        ],
        reminders: ["Take medications daily", "Track BP twice daily"],
        triggers: ["New weakness", "Difficulty speaking", "Confusion"],
        riskMapping: { "Neurologist review": "Risk of recurrent stroke" },
        pharmacy: [{ generic: "Aspirin", brands: ["Ecosprin"], dosage: "75 mg OD" }],
        referral: { specialty: "Neurologist", urgency: "IMMEDIATE", reason: "Acute neuro event." },
        insurance: "Acute infarct requires immediate neuro-critical care.",
        // v8 Communication
        patientMsg: "The report shows a blockage in a brain blood vessel (stroke). You need immediate hospital care. Do not wait. This is a medical emergency that requires urgent treatment to prevent worsening.",
        whatsapp: "Your report shows a Brain Stroke (Infarct).\nYou should visit the Emergency Room immediately.\nWatch for: Weakness or speech difficulty.\nFollow-up: Immediate hospital admission.",
        doctorNote: "Consistent with Acute Ischemic Stroke. Plan: Immediate ICU admission, CT Head, Thrombolysis window review. Follow-up: Daily Neuro review."
    },
    "hemorrhage": { 
        condition: "Internal Bleeding", 
        meaning: "Active bleeding within tissue or cavity.", 
        simple: "Internal bleeding.", 
        severity: "CRITICAL", 
        urgency: "IMMEDIATE",
        probableCause: "Vessel rupture or trauma",
        prognosis: "Life-threatening, immediate surgical review required",
        advice: "This is a medical emergency. Follow the surgical team's advice immediately.",
        correlations: ["trauma", "pain", "hypotension", "dizziness"],
        actions: ["Emergent surgical consult", "Cross-match blood", "Stabilize hemodynamics"],
        followUp: ["Surgical review (daily in ICU)", "Repeat imaging (24h)"],
        medAdjust: ["BP management (tight control)"],
        monitoring: ["GCS score / alertness", "Severe headache"],
        careTasks: [{ id: "task_hem_surg", task: "Surgical Consult", due: "Immediate", type: "consult", hook: "book_appointment" }],
        reminders: ["Strict bed rest", "NPO status"],
        triggers: ["Decreased alertness", "Severe headache"],
        riskMapping: { "Surgical Consult": "Risk of permanent brain damage" },
        pharmacy: [{ generic: "Mannitol", brands: ["Manitol-20"], dosage: "100 ml IV" }],
        referral: { specialty: "Neurosurgeon", urgency: "IMMEDIATE", reason: "Acute bleed evaluation." },
        insurance: "Active hemorrhage requires life-saving surgical intervention.",
        // v8 Communication
        patientMsg: "The scans show bleeding inside (Hemorrhage). You must be admitted to the hospital immediately. This is a critical situation that requires close monitoring and possible surgery.",
        whatsapp: "Your report shows Internal Bleeding.\nYou should seek Emergency care now.\nWatch for: Severe headache or confusion.\nFollow-up: Surgical ICU review.",
        doctorNote: "Consistent with Acute Hemorrhage. Plan: Surgical consult, BP control, ICU monitoring. Follow-up: Repeat CT in 24h."
    },
    "mass": { 
        condition: "Occupying Lesion", 
        meaning: "Solid growth or lesion requiring evaluation.", 
        simple: "An abnormal growth.", 
        severity: "CRITICAL", 
        urgency: "URGENT",
        probableCause: "Inflammation, cyst, or tumor",
        prognosis: "Requires biopsy or specialist imaging for prognosis",
        advice: "Contact an oncologist or specialist surgeon this week.",
        correlations: ["weight loss", "lump", "persistent pain"],
        actions: ["Specialist referral", "Contrast imaging", "Biopsy planning"],
        followUp: ["Oncology review (2-4 days)", "Histopathology results"],
        medAdjust: ["Pain management", "Steroids if edema present"],
        monitoring: ["New pain", "Weight loss tracking"],
        careTasks: [{ id: "task_mass_onc", task: "Oncology Referral", due: "3 days", type: "consult", hook: "book_appointment" }],
        reminders: ["Keep track of your appetite", "Review initial scan results daily"],
        triggers: ["Sudden weight loss", "Severe localized pain"],
        riskMapping: { "Oncology Referral": "Malignant progression risk" },
        pharmacy: [{ generic: "Dexamethasone", brands: ["Decadron"], dosage: "4 mg QID" }],
        referral: { specialty: "Oncologist", urgency: "URGENT", reason: "Diagnostic workup for suspected mass." },
        insurance: "Mass with edema requires urgent oncology workup and biopsy.",
        // v8 Communication
        patientMsg: "The report shows an abnormal growth. You should see a specialist (Oncologist) within the next 2-3 days for more tests like a biopsy. This is important to determine the exact cause early.",
        whatsapp: "Your report shows an abnormal growth (Mass).\nYou should book an Oncology appointment within 3 days.\nWatch for: New pain or weight loss.\nFollow-up: Biopsy as scheduled.",
        doctorNote: "Consistent with SOL / Mass. Plan: Oncology referral, Contrast CT, Biopsy planning. Follow-up: 3 days."
    },
    "fatty liver": { 
        condition: "Fatty Liver", 
        meaning: "Fat accumulation in liver cells.", 
        simple: "Excess fat in the liver.", 
        severity: "MODERATE", 
        urgency: "ROUTINE",
        probableCause: "Obesity, Diabetes, or Alcohol consumption",
        prognosis: "Usually reversible with lifestyle modifications",
        advice: "Avoid alcohol, reduce sugar intake, and aim for 30 min of daily exercise.",
        correlations: ["none", "vague pain", "obesity"],
        actions: ["Lifestyle counseling", "Repeat LFTs in 3 months", "USG follow-up"],
        followUp: ["Gastroenterologist review (3 months)", "Repeat LFT + USG (6 months)"],
        medAdjust: ["Optimise Diabetes meds"],
        monitoring: ["Weight reduction target", "Sugar levels"],
        careTasks: [{ id: "task_fl_lft", task: "Repeat LFT Panel", due: "3 months", type: "lab", hook: "book_lab_test" }],
        reminders: ["Reduce sugar", "Walk for 30 min every day"],
        triggers: ["Yellow eye (Jaundice)", "Severe swelling"],
        riskMapping: { "LFT Panel": "Liver cirrhosis progression risk" },
        pharmacy: [{ generic: "Metformin", brands: ["Glycomet"], dosage: "500 mg BD" }],
        referral: { specialty: "Gastroenterologist", urgency: "ROUTINE", reason: "Management of NAFLD." },
        insurance: "Surveillance of Grade II/III steatosis is necessary to prevent cirrhosis.",
        // v8 Communication
        patientMsg: "The scans show extra fat in your liver. This can be reversed with weight loss, exercise, and avoiding alcohol. Please re-test your liver levels in 3 months to check progress.",
        whatsapp: "Your report shows Fatty Liver.\nYou should skip alcohol and start 30 min daily walking.\nWatch for: Yellowing of eyes (Jaundice).\nFollow-up: Repeat liver tests in 3 months.",
        doctorNote: "Consistent with Steatosis (Grade II). Plan: Lifestyle modification, Diet control, Re-check LFT. Follow-up: 3 months."
    },
    "disc bulge": { 
        condition: "Disc Bulge", 
        meaning: "Intervertebral disc protrusion.", 
        simple: "A bulge in the cushions of the spine.", 
        severity: "MODERATE", 
        urgency: "ROUTINE",
        probableCause: "Poor posture or age-related degeneration",
        prognosis: "Manageable with physiotherapy and core strengthening",
        advice: "Avoid heavy lifting. Consult a physiotherapist for core exercises.",
        correlations: ["back pain", "sciatica", "leg pain", "numbness"],
        actions: ["Physiotherapy", "NSAIDs", "Avoid surgery initially"],
        followUp: ["Physiotherapy 2-4 weeks", "Ortho review if pain persists"],
        medAdjust: ["Escalate NSAID dose"],
        monitoring: ["Leg pain / Numbness", "Bladder/Bowel function"],
        careTasks: [{ id: "task_db_physio", task: "Physiotherapy Program", duration: "4 weeks", type: "rehab", hook: "schedule_session" }],
        reminders: ["Avoid heavy lifting", "Perform core exercises"],
        triggers: ["Loss of bladder control", "Leg weakness"],
        riskMapping: { "Physiotherapy": "Chronic pain/disability risk" },
        pharmacy: [{ generic: "Etoricoxib", brands: ["Nucoxia"], dosage: "90 mg OD" }],
        referral: { specialty: "Ortho / Spine Surgeon", urgency: "ROUTINE", reason: "Disc bulge evaluation." },
        insurance: "Disc herniation with radiculopathy requires specialist orthopedic review and physio.",
        // v8 Communication
        patientMsg: "The report shows a bulge in your spine's cushioning discs. This usually gets better with physiotherapy and proper posture. Avoid lifting heavy weights and start core exercises as advised.",
        whatsapp: "Your report shows a Spine Disc Bulge.\nYou should start Physiotherapy and avoid heavy lifting.\nWatch for: Sudden leg weakness or loss of bladder control.\nFollow-up: Orthopedic review in 2 weeks.",
        doctorNote: "Consistent with Lumbar Disc Prolapse. Plan: NSAIDs, Physiotherapy, Core strengthening. Follow-up: 2 weeks."
    }
};

const RED_FLAG_KEYWORDS = ["infarct", "hemorrhage", "mass", "obstruction", "severe", "collapse", "fracture", "bleed"];

function interpretReport(reportText, symptoms = "", vitals = {}, completedTasks = []) {
    if (!reportText || reportText.trim() === "") {
        return {
            doctorSummary: ["No data"], clinicalMeaning: "N/A", severityLevel: "LOW", redFlags: [],
            actionUrgency: "ROUTINE", suggestedActions: [], followUpPlan: [], medicationAdjustments: [], 
            monitoringPlan: [], careTasks: [], patientReminders: [], escalationTriggers: [],
            executionHooks: [], complianceScore: 100, missedRisks: [],
            pharmacyMap: [], referralNetwork: [], insuranceSupport: [],
            patientMessage: "", whatsappMessage: "", doctorSummaryNote: ""
        };
    }

    const textLower = reportText.toLowerCase();
    const symptomsLower = (symptoms || "").toLowerCase();
    const findings = [];

    Object.keys(DICTIONARY).forEach(key => {
        if (textLower.includes(key)) findings.push({ ...DICTIONARY[key] });
    });

    if (findings.length === 0) {
        return {
            complianceScore: 100, executionHooks: [], missedRisks: [],
            pharmacyMap: [], referralNetwork: [], insuranceSupport: [],
            patientMessage: "Your report does not show any major emergencies. Please correlate with your doctor.",
            whatsappMessage: "Your report seems normal/non-specific. Please visit for clinical review.",
            doctorSummaryNote: "Non-specific findings. Plan: Clinic follow-up.",
            doctorSummary: ["Clinical correlation required"], severityLevel: "LOW"
        };
    }

    // Previous v5-v7 logic
    const careTasks = findings.flatMap(f => f.careTasks || []);
    const patientReminders = [...new Set(findings.flatMap(f => f.reminders || []))];
    const escalationTriggers = [...new Set(findings.flatMap(f => f.triggers || []))];
    const executionHooks = careTasks.map(t => ({ task: t.task, hook: t.hook, type: t.type }));
    let complianceScore = 100;
    const missedRisks = [];
    findings.forEach(f => {
        (f.careTasks || []).forEach(t => {
            if (!completedTasks.includes(t.id)) {
                complianceScore -= 20;
                const risk = Object.keys(f.riskMapping).find(k => t.task.includes(k));
                if (risk) missedRisks.push({ task: t.task, risk: f.riskMapping[risk] });
            }
        });
    });

    const pharmacyMap = findings.flatMap(f => f.pharmacy || []);
    const referralNetwork = findings.map(f => f.referral).filter(r => r != null);
    const insuranceSupport = findings.map(f => f.insurance).filter(i => i != null);

    // v8 Communication
    const patientMessage = findings.map(f => f.patientMsg).join(" ");
    const whatsappMessage = findings[0].whatsapp;
    const doctorSummaryNote = findings[0].doctorNote;

    complianceScore = Math.max(0, complianceScore);
    const urgencyMap = { "CRITICAL": "IMMEDIATE", "HIGH": "URGENT", "MODERATE": "ROUTINE" };
    let highestUrgency = "ROUTINE";
    findings.forEach(f => {
        const u = urgencyMap[f.severity] || "ROUTINE";
        if (u === "IMMEDIATE") highestUrgency = "IMMEDIATE";
        else if (u === "URGENT" && highestUrgency !== "IMMEDIATE") highestUrgency = "URGENT";
    });

    return {
        doctorSummary: findings.slice(0, 5).map(f => f.condition),
        clinicalMeaning: findings[0].meaning,
        patientExplanation: findings.map(f => f.simple).join(" "),
        severityLevel: findings.some(f => f.severity === "CRITICAL") ? "CRITICAL" : (findings.some(f => f.severity === "HIGH") ? "HIGH" : "MODERATE"),
        actionUrgency: highestUrgency,
        suggestedActions: [...new Set(findings.flatMap(f => f.actions || []))],
        followUpPlan: [...new Set(findings.flatMap(f => f.followUp || []))],
        careTasks,
        patientReminders,
        escalationTriggers,
        executionHooks,
        complianceScore,
        missedRisks,
        pharmacyMap,
        referralNetwork,
        insuranceSupport,
        // v8 Fields
        patientMessage,
        whatsappMessage,
        doctorSummaryNote
    };
}

module.exports = { interpretReport };
