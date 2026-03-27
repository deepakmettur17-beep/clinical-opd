const { generatePatientMessage } = require('./app/backend/services/quickExplain');

const testCases = [
    { report: "MRI shows disc bulge at L4-L5." },
    { report: "USG shows fatty liver Grade II." },
    { report: "CT shows acute infarct in MCA territory." }
];

testCases.forEach(tc => {
    console.log(`\n--- REPORT: ${tc.report} ---`);
    const msg = generatePatientMessage(tc.report);
    console.log(msg);
    console.log("Encoded for WA:", encodeURIComponent(msg).substring(0, 50) + "...");
});
