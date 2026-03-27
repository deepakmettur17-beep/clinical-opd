const axios = require('axios');

async function runTests() {
  console.log('Testing Sepsis:');
  try {
    const res = await axios.post('http://localhost:5000/api/clinical', { visit: { chiefComplaint: 'fever', vitals: { bp: '80/50', pulse: '120', spo2: '95' }, ecg: {} }, facility: { hasCathLab: true } });
    console.log("Diagnosis:", res.data.primaryDiagnosis, " | Confidence:", res.data.confidence, " | Differentials:", res.data.differentials);
  } catch(e) { console.error(e.message); }

  console.log('Testing AHF:');
  try {
    const res = await axios.post('http://localhost:5000/api/clinical', { visit: { chiefComplaint: 'shortness of breath', vitals: { bp: '130/80', pulse: '90', spo2: '88' }, ecg: {} }, facility: {} });
    console.log("Diagnosis:", res.data.primaryDiagnosis, " | Confidence:", res.data.confidence, " | Differentials:", res.data.differentials);
  } catch(e) { console.error(e.message); }

  console.log('Testing Anaphylaxis:');
  try {
    const res = await axios.post('http://localhost:5000/api/clinical', { visit: { chiefComplaint: 'allergic reaction', vitals: { bp: '75/40', pulse: '90', spo2: '95' }, ecg: {} }, facility: {} });
    console.log("Diagnosis:", res.data.primaryDiagnosis, " | Confidence:", res.data.confidence, " | Differentials:", res.data.differentials);
  } catch(e) { console.error(e.message); }
}
runTests();
