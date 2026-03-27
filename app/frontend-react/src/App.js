import React from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";

import Patients from "./pages/Patients";
import Visits from "./pages/Visits";
import FollowUpDash from "./pages/FollowUpDash";
import ReportInterpreter from "./pages/ReportInterpreter";
import ExpressCommunicator from "./pages/ExpressCommunicator";

function App() {
  return (
    <Router>
      <div style={{ padding: 20 }}>
        <h1>Clinical OPD System</h1>

        <div style={{ marginBottom: 20 }}>
          <Link to="/patients" style={{ marginRight: 10 }}>Patients</Link>
          <Link to="/visits" style={{ marginRight: 10 }}>Visits</Link>
          <Link to="/interpret" style={{ marginRight: 10 }}>Report Interpreter</Link>
          <Link to="/express" style={{ color: '#22c55e', fontWeight: 'bold' }}>Express ⚡</Link>
        </div>

        <Routes>
          <Route path="/patients" element={<Patients />} />
          <Route path="/visits" element={<Visits />} />
          <Route path="/followup/:patientId" element={<FollowUpDash />} />
          <Route path="/interpret" element={<ReportInterpreter />} />
          <Route path="/express" element={<ExpressCommunicator />} />
          <Route path="*" element={<Patients />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;