const { interpretReport } = require('./app/backend/services/reportInterpreter');

const testCases = [
    {
        name: "Stroke Case (v2)",
        text: "CT Head shows acute infarct in left MCA territory with severe edema.",
        expectSeverity: "CRITICAL"
    },
    {
        name: "Fatty Liver (v2)",
        text: "USG Abdomen suggestive of fatty liver grade II.",
        expectSeverity: "MODERATE"
    },
    {
        name: "Incidental / Normal",
        text: "Study appears unremarkable.",
        expectSeverity: "LOW"
    }
];

testCases.forEach(tc => {
    console.log(`\n--- TEST: ${tc.name} ---`);
    const res = interpretReport(tc.text);
    console.log("Severity Level:", res.severityLevel);
    console.log("Probable Cause:", res.probableCause);
    console.log("Prognosis:", res.prognosis);
    console.log("Patient Advice:", res.patientAdvice);
    console.log("Next Steps:", res.nextSteps);
});
