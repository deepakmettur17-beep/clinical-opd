const fs = require('fs');
const path = require('path');

function logError(caseId, errorMsg) {
  try {
    const logPath = path.join(__dirname, '..', 'errors.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] Case: ${caseId || "UNKNOWN"} | Error: ${errorMsg}\n`;
    fs.appendFileSync(logPath, logEntry);
  } catch(e) {
    console.error("Failed to write to errors.log", e);
  }
}

module.exports = { logError };