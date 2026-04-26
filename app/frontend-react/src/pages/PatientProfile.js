import React, { useEffect, useState } from "react";
import API from "../api";

function PatientProfile({ patient }) {
  const [visits, setVisits] = useState([]);

  useEffect(() => {
    if (patient) {
      API.get("/visits")
        .then(res => {
          const filtered = res.data.filter(
            v => v.patientId?._id === patient._id
          );
          setVisits(filtered);
        });
    }
  }, [patient]);

  if (!patient) return <div>No patient selected</div>;

  return (
    <div>
      <h2>Patient Profile</h2>

      <h3>{patient.name}</h3>
      <p>Age: {patient.age}</p>
      <p>Sex: {patient.sex}</p>
      <p>Phone: {patient.phone}</p>

      <hr />

      <h3>Visit History</h3>

      {visits.length === 0 && <p>No visits yet</p>}

      {visits.map(v => (
        <div key={v._id} style={{ border: "1px solid #ccc", padding: 10, margin: 10 }}>
          <p><b>Date:</b> {new Date(v.createdAt).toLocaleDateString()}</p>
          <p><b>Complaint:</b> {v.chiefComplaint}</p>
          <p><b>Pulse:</b> {v.vitals?.pulse}</p>
          <p><b>SpO2:</b> {v.vitals?.spo2}</p>
          <p><b>Temp:</b> {v.vitals?.temperature}</p>

          <button onClick={() => window.print()}>
            Print Prescription
          </button>
        </div>
      ))}
    </div>
  );
}

export default PatientProfile;
