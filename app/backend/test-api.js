const http = require('http');

const data = JSON.stringify({
  visit: {
    chiefComplaint: "chest pain",
    ecg: {
      stElevationLeads: ["V1", "V2", "V3"],
      reciprocalChanges: true
    }
  },
  facility: {
    hasCathLab: false
  }
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/clinical',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', chunk => {
    body += chunk;
  });
  res.on('end', () => {
    try {
      console.log(JSON.stringify(JSON.parse(body), null, 2));
    } catch (e) {
      console.log(body);
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
