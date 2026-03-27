const { interpretReport } = require('./app/backend/services/reportInterpreter');

const testCases = [
    {
        name: "Stroke Case (v7) - Ecosystem",
        text: "CT Head shows acute infarct.",
        symptoms: "Weakness",
        completed: []
    },
    {
        name: "Fatty Liver (v7) - Ecosystem",
        text: "USG shows fatty liver.",
        symptoms: "",
        completed: []
    }
];

testCases.forEach(tc => {
    console.log(`\n--- TEST: ${tc.name} ---`);
    const res = interpretReport(tc.text, tc.symptoms, {}, tc.completed);
    console.log("Pharmacy Map (First Item):", res.pharmacyMap[0]?.generic, res.pharmacyMap[0]?.brands);
    console.log("Referral:", res.referralNetwork[0]?.specialty, res.referralNetwork[0]?.urgency);
    console.log("Insurance Justification:", res.insuranceSupport[0]);
});
