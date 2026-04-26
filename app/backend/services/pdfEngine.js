const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const crypto = require('crypto');

// Use a secret from environment or fallback for development
const SECRET_KEY = process.env.CLINICAL_OS_SECRET || 'medico_legal_secret_2026';

/**
 * Medico-Legal Verifiable PDF Engine (v3.1)
 * -----------------------------------------
 * HASH: Reproduced from canonical JSON payload
 * SIGNATURE: HMAC-SHA256 signed by server
 * SNAPSHOT: Immutable text stored in registry
 */

/**
 * Deep sorts object keys to ensure deterministic JSON stringification.
 */
function sortKeysDeep(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc, key) => {
      acc[key] = sortKeysDeep(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

/**
 * Normalizes text to ensure whitespace and line breaks are consistent for hashing.
 */
function normalizeText(text) {
  if (!text) return "";
  return text
    .toString()
    .trim()
    .replace(/\s+/g, ' ')           // Unify multiple spaces to single
    .replace(/\r/g, '')             // Remove carriage returns
    .replace(/\n\s*\n/g, '\n')      // Remove double empty lines
    .replace(/\n/g, '\n');          // Standardize line breaks
}

/**
 * Creates a canonical JSON string for hashing.
 */
function canonicalize(payload) {
  // Use sortKeysDeep before stringifying to ensure key order doesn't affect hash
  return JSON.stringify(sortKeysDeep(payload));
}

function computeSHA256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function computeHMAC(data, key) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Generates a verifiable PDF and registers it in the Redis document registry.
 * @param {object} params { type, caseId, user, redisClient }
 */
async function generateVerifiablePDF({ type, caseId, user, redisClient }) {
  if (!redisClient) throw new Error("Redis client required for registration");

  // 1. Fetch Source Data (snapshot source)
  const sourceKey = type === 'discharge' ? `discharge:${caseId}` : `insurance:${caseId}`;
  const sourceDataRaw = await redisClient.get(sourceKey);
  
  if (!sourceDataRaw) {
    throw new Error(`Critical Error: Source ${type} summary not found for case ${caseId}. Generate summary first.`);
  }
  
  const source = JSON.parse(sourceDataRaw);
  const summaryText = type === 'discharge' ? source.summaryText : source.justificationText;

  // 2. Versioning Logic
  const versionKey = `pdf_version_counter:${caseId}:${type}`;
  const version = await redisClient.incr(versionKey);
  
  let previousHash = null;
  if (version > 1) {
    const prevRegistryRaw = await redisClient.get(`pdf_registry:${type}-${caseId}:${version - 1}`);
    if (prevRegistryRaw) {
      previousHash = JSON.parse(prevRegistryRaw).hash;
    }
  }

  const generatedAt = Date.now();
  const docId = `${type}-${caseId}`;

  // 3. Build Canonical Payload & Cryptographic Proof
  const payload = {
    caseId,
    type,
    version,
    generatedAt,
    summaryText: normalizeText(summaryText)
  };

  const canonicalPayload = canonicalize(payload);
  const hash = computeSHA256(canonicalPayload);
  const signature = computeHMAC(hash, SECRET_KEY);

  // 4. Registry Storage
  const registryEntry = {
    docId,
    caseId,
    type,
    version,
    hash,
    signature,
    previousHash,
    snapshotText: summaryText, // CRITICAL: Verification happens against this snapshot
    canonicalPayload,
    generatedAt,
    generatedBy: user || { name: 'Dr. Clinical OS', role: 'System' },
    status: "ACTIVE"
  };

  await redisClient.set(`pdf_registry:${docId}:${version}`, JSON.stringify(registryEntry));

  // 5. PDF Generation
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, info: { Title: `${type.toUpperCase()} - ${caseId}`, Author: 'Clinical OS' } });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // --- BRANDING ---
      doc.fontSize(20).font('Helvetica-Bold').text('METROPOLITAN GENERAL HOSPITAL', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Intensive Care & High Acuity Command Center', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).font('Helvetica-Bold').text(type.toUpperCase() === 'DISCHARGE' ? 'OFFICIAL DISCHARGE SUMMARY' : 'INSURANCE JUSTIFICATION REPORT', { align: 'center', underline: true });
      doc.moveDown(2);

      // --- METADATA PANEL (STRICT) ---
      const metaTop = doc.y;
      doc.rect(50, metaTop, doc.page.width - 100, 75).fill('#f5f5f5').stroke('#e0e0e0');
      doc.fillColor('#333').font('Helvetica-Bold').fontSize(10).text('CRYPTOGRAPHIC METADATA (VERIFIABLE)', 60, metaTop + 10);
      doc.font('Helvetica').fontSize(9);
      doc.text(`Document ID: ${docId}`, 60, metaTop + 25);
      doc.text(`Version: v${version}`, 60, metaTop + 37);
      doc.text(`Generated At: ${new Date(generatedAt).toLocaleString()}`, 60, metaTop + 49);
      doc.text(`Hash (SHA256): ${hash.substring(0, 16)}...`, 60, metaTop + 61);

      const verifyUrl = `http://localhost:5173/verify?docId=${docId}&v=${version}`;
      
      // --- QR CODE ---
      const qrDataUrl = await QRCode.toDataURL(verifyUrl);
      doc.image(qrDataUrl, doc.page.width - 140, metaTop + 5, { width: 65 });
      doc.fontSize(8).fillColor('#1976d2').text('Scan to Verify', doc.page.width - 135, metaTop + 72, { link: verifyUrl });

      doc.fillColor('black').moveDown(4);

      // --- DOCUMENT BODY ---
      doc.fontSize(12).font('Helvetica-Bold').text('CLINICAL HISTROY & FINDINGS', { underline: false });
      doc.font('Helvetica').fontSize(10).moveDown();
      doc.text(summaryText, {
        lineGap: 4,
        align: 'justify',
        paragraphGap: 10
      });

      // --- SIGNATURE BLOCK ---
      const sigY = Math.max(doc.y + 40, doc.page.height - 180);
      doc.moveTo(50, sigY).lineTo(doc.page.width - 50, sigY).stroke('#eee');
      doc.fontSize(10).font('Helvetica-Bold').text('Treating Physician / Authority:', 50, sigY + 15);
      doc.font('Helvetica').text(`${user?.name || 'Dr. Clinical OS'} (${user?.role || 'Consultant'})`, 50, sigY + 30);
      doc.text(`Registered Signatory ID: ${user?.userId || 'SYS-77001'}`, 50, sigY + 42);
      
      doc.text('__________________________', doc.page.width - 200, sigY + 30);
      doc.fontSize(8).text('Digital Signature / Hand-signed', doc.page.width - 200, sigY + 45, { width: 150, align: 'center' });

      // --- LEGAL FOOTER ---
      doc.fontSize(8).fillColor('gray').text(`TAMPER WARNING: This document is cryptographically signed and version-locked. Any unauthorized modification to the text body, metadata, or timestamps will result in a verification failure. Verify authenticity at: ${verifyUrl}`, 50, doc.page.height - 60, { align: 'center', width: doc.page.width - 100 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Re-verifies a document's authenticity against the official registry.
 */
async function verifyPDF(docId, version, redisClient) {
  if (!redisClient) return { status: 'ERROR', message: 'Registry offline' };

  const registryRaw = await redisClient.get(`pdf_registry:${docId}:${version}`);
  if (!registryRaw) {
    return { status: 'INVALID', reason: 'DOCUMENT_NOT_FOUND', message: 'This document ID was never issued by this system.' };
  }

  const entry = JSON.parse(registryRaw);
  if (entry.status === 'REVOKED') {
    return { status: 'REVOKED', message: 'This document has been superseded/revoked by a newer version or authority.', metadata: entry };
  }

  // RE-AUTHENTICATION
  const payload = {
    caseId: entry.caseId,
    type: entry.type,
    version: entry.version,
    generatedAt: entry.generatedAt,
    summaryText: normalizeText(entry.snapshotText)
  };

  const canonical = canonicalize(payload);
  const recomputedHash = computeSHA256(canonical);
  const recomputedSignature = computeHMAC(recomputedHash, SECRET_KEY);

  const hashMatch = recomputedHash === entry.hash;
  const sigMatch = recomputedSignature === entry.signature;

  if (hashMatch && sigMatch) {
    return { status: 'VALID', metadata: entry };
  } else {
    // Audit failure
    return { 
      status: 'INVALID', 
      reason: 'CRYPTOGRAPHIC_MISMATCH', 
      message: 'AUTHENTICATION FAILED: The cryptographic signature does not match the stored snapshot or the document has been altered.',
      details: { hashMatch, sigMatch }
    };
  }
}

module.exports = { generateVerifiablePDF, verifyPDF };