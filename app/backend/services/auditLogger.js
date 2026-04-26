const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

class AuditLogger {
  constructor() {
    this.logFilePath = path.join(__dirname, '..', 'audit_logs_secure.jsonl');
    this.memoryQueue = [];
    this.cacheDb = new Map();
    this.isWriting = false;
    this.globalSafeMode = false;
    
    // Initialize Hash Chain
    this.lastHash = "0000000000000000000000000000000000000000000000000000000000000000";
    if (fs.existsSync(this.logFilePath)) {
      const logs = fs.readFileSync(this.logFilePath, 'utf-8').trim().split('\n');
      if (logs.length > 0 && logs[logs.length - 1]) {
        try {
          const lastEntry = JSON.parse(logs[logs.length - 1]);
          if (lastEntry.currentHash) this.lastHash = lastEntry.currentHash;
        } catch (e) {
          // Fallback empty hash
        }
      }
    }
  }

  isDuplicate(requestId) {
    return this.cacheDb.has(requestId);
  }

  getCached(requestId) {
    return this.cacheDb.get(requestId);
  }

  cacheResult(requestId, result) {
    if (!requestId) return;
    this.cacheDb.set(requestId, result);
    // Prune logic if needed for prod
  }

  verifyChainIntegrity() {
    if (!fs.existsSync(this.logFilePath)) return true;
    const logs = fs.readFileSync(this.logFilePath, 'utf-8').trim().split('\n');
    let verifyHash = "0000000000000000000000000000000000000000000000000000000000000000";
    
    for (const l of logs) {
      if (!l) continue;
      try {
        const entry = JSON.parse(l);
        if (entry.previousHash !== verifyHash) {
          this.globalSafeMode = true;
          return false;
        }
        const strPayload = JSON.stringify(entry.payload);
        const computed = crypto.createHash('sha256').update(verifyHash + strPayload).digest('hex');
        if (computed !== entry.currentHash) {
          this.globalSafeMode = true;
          return false;
        }
        verifyHash = entry.currentHash;
      } catch (e) {
        this.globalSafeMode = true;
        return false;
      }
    }
    return true;
  }

  async appendLog(requestId, payload) {
    const timestamp = new Date().toISOString();
    const strPayload = JSON.stringify(payload);
    
    const currentHash = crypto.createHash('sha256').update(this.lastHash + strPayload).digest('hex');
    
    const logEntry = {
      timestamp,
      requestId,
      previousHash: this.lastHash,
      currentHash,
      payload
    };

    this.lastHash = currentHash;
    this.memoryQueue.push(logEntry);

    return this.processQueue();
  }

  async processQueue(retries = 3) {
    if (this.isWriting || this.memoryQueue.length === 0) return true;
    this.isWriting = true;

    const entry = this.memoryQueue[0];
    try {
      fs.appendFileSync(this.logFilePath, JSON.stringify(entry) + '\n');
      this.memoryQueue.shift(); // Remove on success
      this.isWriting = false;
      if (this.memoryQueue.length > 0) this.processQueue();
      return true;
    } catch (e) {
      console.error("CRITICAL AUDIT ERROR: Failed to persist to disk. Retrying...", e);
      this.isWriting = false;
      if (retries > 0) {
        await new Promise(r => setTimeout(r, Math.random() * 500 + 200)); // Exponential backoff simulation
        return this.processQueue(retries - 1);
      } else {
        this.globalSafeMode = true; // Safe mode engages if logger drops
        return false;
      }
    }
  }
}

const GlobalLogger = new AuditLogger();
module.exports = { GlobalLogger };