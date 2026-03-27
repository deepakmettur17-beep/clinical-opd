const { interpretReport } = require('./app/backend/services/reportInterpreter');

const testCases = [
    {
        name: "Stroke Case (v4)",
        text: "CT Head shows acute infarct.",
        symptoms: "Weakness",
        expectFollowUp: true
    },
    {
        name: "Fatty Liver (v4)",
        text: "USG shows fatty liver.",
        symptoms: "",
        expectFollowUp: true
    }
];

testCases.forEach(tc => {
    console.log(`\n--- TEST: ${tc.name} ---`);
    const res = interpretReport(tc.text, tc.symptoms);
    console.log("Follow-Up Plan:", res.followUpPlan);
    console.log("Medication Adjustments:", res.medicationAdjustments);
    console.log("Monitoring Plan:", res.monitoringPlan);
});
