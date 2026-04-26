/**
 * Express Patient Communicator (v8.0 - Final Form)
 * Logic: Strict 1-line explanation, home-based micro-actions, and under 6 lines formatting.
 */

const MAPPINGS = [
    { key: "disc bulge", condition: "a mild disc issue in your back", bucket: "spine", severity: "mild" },
    { key: "cervical spondylosis", condition: "age-related changes in your neck", bucket: "spine", severity: "mild" },
    { key: "fatty liver", condition: "a small amount of fat in your liver", bucket: "liver", severity: "mild" },
    { key: "grade 1 fatty liver", condition: "early mild fat in your liver", bucket: "liver", severity: "mild" },
    { key: "infarct", condition: "a blockage in your blood supply", bucket: "brain", severity: "severe" },
    { key: "hemorrhage", condition: "some bleeding in your brain", bucket: "brain", severity: "severe" },
    { key: "pleural effusion", condition: "some fluid around your lungs", bucket: "lung", severity: "moderate" },
    { key: "consolidation", condition: "a small infection in your lung", bucket: "lung", severity: "moderate" },
    { key: "renal stone", condition: "a kidney stone", bucket: "kidney", severity: "moderate" },
    { key: "cardiomegaly", condition: "an enlarged heart", bucket: "heart", severity: "moderate" }
];

const BUCKETS = {
    spine: { 
        action: "You can start gentle stretching at home and avoid heavy lifting for now.",
        danger: "sudden leg weakness or loss of bladder control"
    },
    liver: { 
        action: "Try reducing oily food and walking daily for 20-30 minutes.",
        danger: "yellowing of eyes or severe stomach pain"
    },
    brain: { 
        action: "Please consult a neurologist immediately today.",
        danger: "new weakness or slurred speech"
    },
    lung: { 
        action: "Monitor your breathing and check your temperature regularly.",
        danger: "sudden breathlessness or chest pain"
    },
    kidney: { 
        action: "Keep yourself well hydrated and avoid delaying urination.",
        danger: "severe side pain or bloody urine"
    },
    heart: { 
        action: "Schedule a cardiology review for an ECG or Echo soon.",
        danger: "chest pain or radiation to arms"
    },
    thyroid: { 
        action: "Consult an endocrine specialist for a thyroid check-up.",
        danger: "sudden weight change or tremors"
    }
};

const SEVERITY = {
    mild: { 
        followUp: "if symptoms continue after 2 weeks",
        nudge: "This is common and usually settles with regular care.",
        reassure: true 
    },
    moderate: { 
        followUp: "within 1 week",
        nudge: "This usually improves faster with guided medical care.",
        reassure: false 
    },
    severe: { 
        followUp: "today / immediately",
        nudge: "", 
        reassure: false 
    }
};

function generatePatientMessage(reportText, patientName = "") {
    const greeting = patientName ? `Hello ${patientName},` : "Hello,";

    if (!reportText || reportText.trim() === "") {
        return `${greeting}

Your report has been reviewed.

No major dangerous findings are mentioned.

Please follow up with your doctor for confirmation.`;
    }

    const textLower = reportText.toLowerCase();
    const match = MAPPINGS.find(m => textLower.includes(m.key));

    if (!match) {
        return `${greeting}

Your report has been reviewed.

No major dangerous findings are mentioned.

Please follow up with your doctor for confirmation.`;
    }

    const bucket = BUCKETS[match.bucket];
    const severity = SEVERITY[match.severity];
    
    // 1-line explanation strictly
    let explanation = "";
    if (severity.reassure) {
        explanation = `This is commonly seen and usually manageable with home care. ${severity.nudge}`;
    } else if (match.severity === 'moderate') {
        explanation = `The findings show a condition that needs clinical check-up and care. ${severity.nudge}`;
    } else {
        explanation = `The scan shows significant findings that require immediate medical attention.`;
    }

    const message = `${greeting}

Your report shows: ${match.condition}

${explanation}

What you can do now:
${bucket.action}

Watch for:
⚠️ ${bucket.danger}

Next step:
Review with your doctor ${severity.followUp}`;

    // Confidence Safety Check
    if (reportText.trim().split(/\s+/).length < 12) {
        return message + "\n\nThis is based on the report. Your doctor will confirm clinically.";
    }

    return message;
}

module.exports = { generatePatientMessage };