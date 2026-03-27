const fs = require('fs');
try {
  const te = require('./app/backend/services/treatmentEngine');
  fs.writeFileSync('diag-results.txt', 'Success');
} catch (e) {
  fs.writeFileSync('diag-results.txt', e.stack || e.message);
}
