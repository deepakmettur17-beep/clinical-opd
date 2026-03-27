const { interpretReport } = require('./app/backend/services/reportInterpreter');

const testCases = [
    {
        name: "Stroke Case",
        text: "CT Head shows acute infarct in left MCA territory with mild edema.",
        expectRedFlag: true
    },
    {
        name: "Fatty Liver",
        text: "USG Abdomen suggestive of fatty liver grade II.",
        expectRedFlag: false
    },
    {
        name: "Empty Case",
        text: "",
        expectRedFlag: false
    }
];

testCases.forEach(tc => {
    console.log(`\n--- TEST: ${tc.name} ---`);
    const res = interpretReport(tc.text);
    console.log("Doctor Summary:", res.doctorSummary);
    console.log("Patient Explanation:", res.patientExplanation);
    console.log("Red Flags:", res.redFlags);
    console.log("Next Steps:", res.nextSteps);
});
