const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://localhost:8080/api/quick-explain', {
      reportText: "MRI shows disc bulge",
      patientName: "John Doe"
    });
    console.log('API Response:', res.data);
  } catch (e) {
    console.error('API Error:', e.response ? e.response.data : e.message);
  }
}
test();
