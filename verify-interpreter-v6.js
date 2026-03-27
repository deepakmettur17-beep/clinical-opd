const { interpretReport } = require('./app/backend/services/reportInterpreter');

const testCases = [
    {
        name: "Stroke Case (v6) - Execution",
        text: "CT Head shows acute infarct.",
        symptoms: "Weakness",
        completed: [] // No tasks completed
    },
    {
        name: "Disc Bulge (v6) - Execution",
        text: "MRI Spine shows disc bulge.",
        symptoms: "Back pain",
        completed: ["task_db_physio"] // Completed one task
    }
];

testCases.forEach(tc => {
    console.log(`\n--- TEST: ${tc.name} ---`);
    const res = interpretReport(tc.text, tc.symptoms, {}, tc.completed);
    console.log("Compliance Score:", res.complianceScore);
    console.log("Missed Risks:", res.missedRisks.length);
    if (res.missedRisks.length > 0) {
        console.log("Example Risk:", res.missedRisks[0].risk);
    }
    console.log("Execution Hooks:", res.executionHooks.map(h => h.hook));
});
