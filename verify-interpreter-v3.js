const { interpretReport } = require('./app/backend/services/reportInterpreter');

const testCases = [
    {
        name: "Stroke Case (v3) - Correlated",
        text: "CT Head shows acute infarct in left MCA territory.",
        symptoms: "Right sided weakness and slurred speech",
        expectUrgency: "IMMEDIATE"
    },
    {
        name: "Disc Bulge (v3) - Mismatch",
        text: "MRI Spine shows disc bulge at L4-L5.",
        symptoms: "Headache and vision blur",
        expectUrgency: "ROUTINE"
    },
    {
        name: "Hemorrhage (v3) - Immediate Always",
        text: "Active hemorrhage detected.",
        symptoms: "",
        expectUrgency: "IMMEDIATE"
    }
];

testCases.forEach(tc => {
    console.log(`\n--- TEST: ${tc.name} ---`);
    const res = interpretReport(tc.text, tc.symptoms);
    console.log("Urgency:", res.actionUrgency);
    console.log("Correlation:", res.clinicalCorrelation);
    console.log("Suggested Actions:", res.suggestedActions);
});
