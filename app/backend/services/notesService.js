const crypto = require('crypto');

const getNotesKey = (caseId) => `notes:${caseId}`;

/**
 * Detect critical clinical keywords
 */
const detectCriticality = (content = {}) => {
    const text = JSON.stringify(content).toLowerCase();
    const keywords = ['deteriorating', 'hypoxia', 'unresponsive'];
    return keywords.some(k => text.includes(k));
};

/**
 * Add a new clinical note to Redis
 * @param {string} caseId 
 * @param {Object} redisClient 
 * @param {Object} noteData { type, user, content, roundId, parentNoteId, isAddendum }
 */
const addClinicalNote = async (caseId, redisClient, noteData) => {
    if (!redisClient) return null;
    
    const isCritical = detectCriticality(noteData.content);
    const entry = {
        id: crypto.randomUUID(),
        ...noteData,
        isCritical,
        timestamp: Date.now()
    };

    const key = getNotesKey(caseId);
    await redisClient.rPush(key, JSON.stringify(entry));
    return entry;
};

/**
 * Retrieve all clinical notes for a case
 */
const getClinicalNotes = async (caseId, redisClient) => {
    if (!redisClient) return [];
    
    const key = getNotesKey(caseId);
    const notes = await redisClient.lRange(key, 0, -1);
    return notes.map(n => JSON.parse(n));
};

module.exports = {
    addClinicalNote,
    getClinicalNotes,
    detectCriticality
};