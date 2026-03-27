import React, { useState } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

function ExpressCommunicator() {
  const [reportText, setReportText] = useState("");
  const [patientName, setPatientName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!reportText.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/quick-explain`, { reportText, patientName });
      setMessage(res.data.message);
    } catch (err) {
      console.error(err);
      alert("Error generating message");
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsApp = () => {
    if (!message) return;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="express-container">
      <header className="express-header">
        <h1>Express Communicator</h1>
        <p>Paste report ➡️ Open WhatsApp</p>
      </header>

      <main className="express-main">
        <section className="input-section">
          <input
            type="text"
            className="express-input-name"
            placeholder="Patient Name (Optional)"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
          <textarea
            className="express-textarea"
            placeholder="PASTE RAW MEDICAL REPORT HERE..."
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
          />
          <button className="btn-primary-large" onClick={handleGenerate} disabled={loading}>
            {loading ? "GENERATING..." : "GENERATE EXPLANATION"}
          </button>
        </section>

        {message && (
          <section className="output-section">
            <div className="message-preview">
                <pre>{message}</pre>
            </div>
            
            <div className="action-row">
                <button className="btn-whatsapp-large" onClick={handleWhatsApp}>
                    SEND VIA WHATSAPP 📤
                </button>
                <button className="btn-secondary-large" onClick={() => {
                   navigator.clipboard.writeText(message);
                   alert("Copied to clipboard!");
                }}>
                   COPY TEXT 📋
                </button>
            </div>
            
            <button className="btn-clear" onClick={() => {
                setReportText("");
                setMessage("");
            }}>NEW REPORT 🔄</button>
          </section>
        )}
      </main>
    </div>
  );
}

export default ExpressCommunicator;
