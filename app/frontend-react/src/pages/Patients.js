import React, { useEffect, useState } from "react";
import { fetchPatients, createPatient, deletePatient } from "../services/API";

function Patients() {
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState({
    name: "",
    age: "",
    sex: "",
    phone: "",
  });

  const loadPatients = async () => {
    const res = await fetchPatients();
    setPatients(res.data);
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createPatient(form);
    setForm({ name: "", age: "", sex: "", phone: "" });
    loadPatients();
  };

  const handleDelete = async (id) => {
    await deletePatient(id);
    loadPatients();
  };

  return (
    <div className="container">
      <h2>Patient List</h2>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
        />

        <input
          placeholder="Age"
          value={form.age}
          onChange={(e) =>
            setForm({ ...form, age: e.target.value })
          }
        />

        <input
          placeholder="Sex"
          value={form.sex}
          onChange={(e) =>
            setForm({ ...form, sex: e.target.value })
          }
        />

        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: e.target.value })
          }
        />

        <button type="submit">Add Patient</button>
      </form>

      <br />

      {patients.map((p) => (
        <div
          key={p._id}
          style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}
        >
          <strong>{p.name}</strong>
          <br />
          Age: {p.age} | Sex: {p.sex}
          <br />
          Phone: {p.phone}
          <br />
          <button 
            onClick={() => window.location.href = `/followup/${p._id}`}
            style={{ marginLeft: 10, backgroundColor: "#2563eb", color: "white", border: "none", padding: "5px 10px", borderRadius: 4, cursor: "pointer" }}
          >
            Follow-Up
          </button>
          <button 
            onClick={() => handleDelete(p._id)}
            style={{ marginLeft: 10, color: "red" }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

export default Patients;
