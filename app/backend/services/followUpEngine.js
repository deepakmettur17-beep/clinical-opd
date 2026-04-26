const mongoose = require("mongoose");
const Visit = require("../models/Visit");

/**
 * Follow-Up Engine (Chronic Disease)
 * Logic for trend analysis and automated medication suggestions.
 */

const analyzeTrends = async (patientId) => {
  // Fetch last 3-5 finalized visits
  const history = await Visit.find({ patientId, finalized: true })
    .sort({ finalizedAt: -1 })
    .limit(5);

  if (history.length === 0) return null;

  const trends = {
    hba1c: [],
    fbs: [],
    ppbs: [],
    sbp: [],
    painScore: []
  };

  history.forEach(v => {
    if (v.labs?.hba1c) trends.hba1c.push({ val: v.labs.hba1c, date: v.finalizedAt });
    if (v.labs?.fbs) trends.fbs.push({ val: v.labs.fbs, date: v.finalizedAt });
    if (v.labs?.ppbs) trends.ppbs.push({ val: v.labs.ppbs, date: v.finalizedAt });
    if (v.vitals?.bp) {
      const sbp = parseInt(v.vitals.bp.split('/')[0]);
      if (!isNaN(sbp)) trends.sbp.push({ val: sbp, date: v.finalizedAt });
    }
    if (v.chronicDiseaseMarkers?.painScore !== undefined) {
      trends.painScore.push({ val: v.chronicDiseaseMarkers.painScore, date: v.finalizedAt });
    }
  });

  // Calculate direction (worsening vs improving)
  const getStatus = (arr, lowerIsBetter = true) => {
    if (arr.length < 2) return "Stable";
    const current = arr[0].val;
    const previous = arr[1].val;
    
    if (lowerIsBetter) {
      if (current > previous + 0.2) return "Worsening âš ï¸";
      if (current < previous - 0.2) return "Improving âœ…";
    } else {
      if (current < previous - 1) return "Worsening âš ï¸";
      if (current > previous + 1) return "Improving âœ…";
    }
    return "Stable";
  };

  return {
    summary: {
      hba1cStatus: getStatus(trends.hba1c),
      bpStatus: getStatus(trends.sbp),
      painStatus: getStatus(trends.painScore, true), // Lower pain is better
    },
    history: trends,
    lastVisit: history[0].finalizedAt
  };
};

const getSuggestions = (trends, currentMeds) => {
  const suggestions = [];

  // Diabetes logic
  if (trends.summary.hba1cStatus.includes("Worsening")) {
    suggestions.push({
      condition: "Diabetes",
      reason: "HbA1c rising despite current therapy",
      action: "Increase dose of Oral Hypoglycemic Agents (OHA) or add Insulin"
    });
  } else if (trends.summary.hba1cStatus.includes("Improving")) {
    suggestions.push({
      condition: "Diabetes",
      reason: "HbA1c showing good control",
      action: "Continue same dose"
    });
  }

  // Hypertension logic
  if (trends.summary.bpStatus.includes("Worsening")) {
    suggestions.push({
      condition: "Hypertension",
      reason: "SBP trend rising",
      action: "Consider increasing Anti-Hypertensive dose"
    });
  }

  return suggestions;
};

module.exports = { analyzeTrends, getSuggestions };