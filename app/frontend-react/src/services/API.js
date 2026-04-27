import axios from 'axios';
import { API_BASE_URL } from "../config";
const API_BASE = `${API_BASE_URL}`;
const API = axios.create({
  baseURL: API_BASE,
});

// ===== PATIENTS =====

export const fetchPatients = () => {
  return API.get("/api/patients");
};

export const createPatient = (data) => {
  return API.post("/api/patients", data);
};

export const deletePatient = (id) => {
  return API.delete(`/api/patients/${id}`);
};

// ===== VISITS =====

export const fetchVisits = () => {
  return API.get("/api/visits");
};

export const createVisit = (data) => {
  return API.post("/api/visits", data);
};

export const deleteVisit = (id) => {
  return API.delete(`/api/visits/${id}`);
};

// ===== AI SUGGESTIONS =====


export const getAISuggestions = (complaint, vitals, age, sex, labs) => {
  return API.post("/api/clinical", { complaint, vitals, age, sex, labs });
};

export const getFollowUpAnalysis = (patientId) => {
  return API.get(`/api/clinical/followup/${patientId}`);
};

export const getPharmacyStock = (query) => {
  return API.get(`/api/pharmacy/stock/${query}`);
};
export const interpretReport = (reportText, symptoms = "", vitals = {}) => {
  return API.post("/api/clinical/interpret-report", { reportText, symptoms, vitals });
};

