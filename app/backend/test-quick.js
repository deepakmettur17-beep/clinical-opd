const http = require('http');

const data = JSON.stringify({
    reportText: "MRI shows mild disc bulge",
    patientName: "Test Patient"
});

const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/api/quick-explain',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => { responseBody += chunk; });
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${responseBody}`);
        if (res.statusCode === 200) {
            process.exit(0);
        } else {
            console.error('API Test Failed!');
            process.exit(1);
        }
    });
});

req.on('error', (error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
});

req.write(data);
req.end();
