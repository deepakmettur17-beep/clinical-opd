const { interpretReport } = require('./app/backend/services/reportInterpreter');

const testCases = [
    {
        name: "Stroke Case (v5) - Tracking",
        text: "CT Head shows acute infarct.",
        symptoms: "Weakness",
        expectTasks: true
    },
    {
        name: "Disc Bulge (v5) - Tracking",
        text: "MRI Spine shows disc bulge.",
        symptoms: "Back pain",
        expectTasks: true
    }
];

testCases.forEach(tc => {
    console.log(`\n--- TEST: ${tc.name} ---`);
    const res = interpretReport(tc.text, tc.symptoms);
    console.log("Care Tasks:", res.careTasks);
    console.log("Patient Reminders:", res.patientReminders);
    console.log("Danger Signs:", res.escalationTriggers);
});
