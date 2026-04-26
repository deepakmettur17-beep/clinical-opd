import React, { useEffect, useState } from "react";
import {
  fetchPatients,
  fetchVisits,
  createVisit,
  deleteVisit,
  getAISuggestions
} from "../services/API";

function Visits() {

  // ================= STATES =================
  const [patients, setPatients] = useState([]);
  const [visits, setVisits] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [aiResult, setAiResult] = useState("");

  const [form, setForm] = useState({
    complaint: "",
    pulse: "",
    spo2: "",
    temperature: "",
    bp: "",
    diagnosis: "",
    prescription: "",
    notes: ""
  });

  // ================= LOAD DATA =================
  useEffect(() => {
    loadPatients();
    loadVisits();
  }, []);

  const loadPatients = async () => {
    try {
      const res = await fetchPatients();
      setPatients(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadVisits = async () => {
    try {
      const res = await fetchVisits();
      setVisits(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= HANDLE CHANGE =================
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ================= CREATE VISIT =================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedPatient) {
      alert("Select patient first");
      return;
    }

    try {
      await createVisit({
        patientId: selectedPatient,
        complaint: form.complaint,
        vitals: {
          pulse: form.pulse,
          spo2: form.spo2,
          temperature: form.temperature,
          bp: form.bp
        },
        diagnosis: form.diagnosis,
        prescription: form.prescription,
        notes: form.notes
      });

      setForm({
        complaint: "",
        pulse: "",
        spo2: "",
        temperature: "",
        bp: "",
        diagnosis: "",
        prescription: "",
        notes: ""
      });

      loadVisits();
    } catch (err) {
      console.error(err);
    }
  };

  // ================= DELETE VISIT =================
  const handleDelete = async (id) => {
    try {
      await deleteVisit(id);
      loadVisits();
    } catch (err) {
      console.error(err);
    }
  };

  // ================= AI SUGGEST =================
  const handleAISuggest = async () => {
    try {
      const res = await getAISuggestions(
        form.complaint,
        {
          pulse: form.pulse,
          spo2: form.spo2,
          temperature: form.temperature,
          bp: form.bp
        },
        45, // temporary hardcoded age
        "Male" // temporary
      );
      setAiResult(res.data);
    } catch (err) {
      console.error("AI Error:", err);
      alert("AI suggestion failed. Check if clinical engine is active.");
    }
  };
  
  // ================= UI =================
  return (
    <div style={{ padding: "20px" }}>

      <h2>Visit Management</h2>

      {/* PATIENT SELECT */}
      <select
        value={selectedPatient}
        onChange={(e) => setSelectedPatient(e.target.value)}
      >
        <option value="">Select Patient</option>
        {patients.map((p) => (
          <option key={p._id} value={p._id}>
            {p.name}
          </option>
        ))}
      </select>

      <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>

        <input name="complaint" placeholder="Complaint" value={form.complaint} onChange={handleChange} />
        <input name="pulse" placeholder="Pulse" value={form.pulse} onChange={handleChange} />
        <input name="spo2" placeholder="SpO2" value={form.spo2} onChange={handleChange} />
        <input name="temperature" placeholder="Temperature" value={form.temperature} onChange={handleChange} />
        <input name="bp" placeholder="BP" value={form.bp} onChange={handleChange} />
        <input name="diagnosis" placeholder="Diagnosis" value={form.diagnosis} onChange={handleChange} />
        <input name="prescription" placeholder="Prescription" value={form.prescription} onChange={handleChange} />
        <input name="notes" placeholder="Notes" value={form.notes} onChange={handleChange} />

        <br /><br />

        <button type="submit">Add Visit</button>
        <button type="button" onClick={handleAISuggest} style={{ marginLeft: "10px" }}>
          AI Suggest
        </button>
      </form>

      {/* AI RESULT */}
      {aiResult && (
  <div style={{ marginTop: "20px", background: "#f4f4f4", padding: "15px" }}>
    <h3>AI Clinical Decision Support</h3>

    <h4>Possible Diagnoses</h4>
    <ul>
      {aiResult.diagnoses.map((d, i) => (
        <li key={i}>
          <strong>{d.condition}</strong> â€” {d.probability}
        </li>
      ))}
    </ul>

    <h4>Red Flags</h4>
    <ul>
      {aiResult.redFlags.map((r, i) => (
        <li key={i}>{r}</li>
      ))}
    </ul>

    <h4>Investigations</h4>
    <ul>
      {aiResult.investigations.map((inv, i) => (
        <li key={i}>{inv}</li>
      ))}
    </ul>

    <h4>Management</h4>
    <ul>
      {aiResult.management.map((m, i) => (
        <li key={i}>{m}</li>
      ))}
    </ul>

    <h4>Urgency Level</h4>
    <strong>{aiResult.urgency}</strong>
  </div>
)}

      <hr />

      {/* VISIT LIST */}
      <h3>All Visits</h3>
      {visits.map((v) => (
        <div key={v._id} style={{ marginBottom: "15px", borderBottom: "1px solid #ccc" }}>
          <strong>Complaint:</strong> {v.complaint} <br />
          <strong>Pulse:</strong> {v.vitals?.pulse} <br />
          <strong>SpO2:</strong> {v.vitals?.spo2} <br />
          <strong>Temp:</strong> {v.vitals?.temperature} <br />
          <strong>BP:</strong> {v.vitals?.bp} <br />
          <strong>Diagnosis:</strong> {v.diagnosis} <br />
          <strong>Prescription:</strong> {v.prescription} <br />
          <strong>Notes:</strong> {v.notes} <br />
          <button onClick={() => handleDelete(v._id)}>Delete</button>
        </div>
      ))}

    </div>
  );
}

export default Visits;

