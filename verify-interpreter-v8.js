const { interpretReport } = require('./app/backend/services/reportInterpreter');

const testCases = [
    {
        name: "Stroke Case (v8) - Communication",
        text: "CT Head shows acute infarct.",
        symptoms: "Weakness"
    },
    {
        name: "Fatty Liver (v8) - Communication",
        text: "USG shows fatty liver."
    }
];

testCases.forEach(tc => {
    console.log(`\n--- TEST: ${tc.name} ---`);
    const res = interpretReport(tc.text, tc.symptoms);
    console.log("Patient Message:", res.patientMessage);
    console.log("WhatsApp Preview:", res.whatsappMessage.split('\n')[0]);
    console.log("Doctor Note:", res.doctorSummaryNote);
});
