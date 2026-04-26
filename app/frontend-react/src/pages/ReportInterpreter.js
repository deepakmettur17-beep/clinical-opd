import React, { useState } from "react";
import { interpretReport } from "../services/API";

function ReportInterpreter() {
  const [reportText, setReportText] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [interpretation, setInterpretation] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleInterpret = async () => {
    if (!reportText.trim()) return;
    setLoading(true);
    try {
      const res = await interpretReport(reportText, symptoms);
      setInterpretation(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="interpreter-page">
      <header className="page-header">
        <h2>Clinical Report Interpreter</h2>
        <p>Convert complex imaging & lab reports into clear summaries</p>
      </header>

      <div className="dashboard-grid">
        <section className="column">
          <div className="card input-card">
            <h3>Paste Raw Medical Report</h3>
            <textarea 
              className="report-input" 
              placeholder="Paste MRI, CT, USG or complex lab text here..."
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
            />
            
            <h3>Clinical Context (Optional)</h3>
            <input 
              type="text"
              className="context-input"
              placeholder="Enter patient symptoms (e.g. back pain, weakness)..."
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            />

            <button className="btn-interpret" onClick={handleInterpret} disabled={loading}>
              {loading ? "Analyzing..." : "Interpret Report NOW"}
            </button>
          </div>
        </section>

        <section className="column">
          {interpretation && (
            <div className="interpretation-results">
              
              <div className="card doctor-card border-left-decision">
                <h3>🧠 Clinical Decision Layer</h3>
                <div className="flex-row">
                    <span className={`urgency-badge ${interpretation.actionUrgency.toLowerCase()}`}>
                        {interpretation.actionUrgency}
                    </span>
                    <span className="source-tag">Rule Engine v3</span>
                </div>
                
                <div className="correlation-box">
                    <strong>Correlation:</strong> {interpretation.clinicalCorrelation}
                </div>

                <div className="suggested-actions">
                    <strong>Suggested Actions:</strong>
                    <ul>
                        {interpretation.suggestedActions.map((act, idx) => <li key={idx}>{act}</li>)}
                    </ul>
                </div>
              </div>

              <div className="card doctor-card">
                <h3>🔍 Key Findings</h3>
                <ul>
                  {interpretation.doctorSummary.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>

              <div className="card meaning-card">
                <h3>👨‍⚕️ Clinical Analysis</h3>
                <div className="analysis-grid">
                    <div>
                        <label>Pathophysiology</label>
                        <p>{interpretation.clinicalMeaning}</p>
                    </div>
                    <div>
                        <label>Probable Cause</label>
                        <p>{interpretation.probableCause}</p>
                    </div>
                </div>
              </div>

              <div className="card urgency-card highlight">
                <h3>⚠️ Severity & Prognosis</h3>
                <p><strong>Outlook:</strong> {interpretation.prognosis}</p>
                {interpretation.redFlags.length > 0 && (
                    <div className="red-flags-box">
                        {interpretation.redFlags.map((rf, i) => <div key={i} className="red-text">{rf}</div>)}
                    </div>
                )}
              </div>

              <div className="card patient-card ivory">
                <h3>👤 For Patient</h3>
                <p className="simple-text">{interpretation.patientExplanation}</p>
                <div className="advice-box">
                    <strong>Actionable Advice:</strong>
                    <p>{interpretation.patientAdvice}</p>
                </div>
              </div>

              <div className="card next-steps-card">
                <h3>➡️ Next Clinical Steps</h3>
                <ul>
                  {interpretation.nextSteps.map((ns, i) => <li key={i}>{ns}</li>)}
                </ul>
              </div>

              <div className="card follow-up-card highlight-green">
                <h3>📅 Follow-Up & Care Plan</h3>
                
                <div className="care-section">
                    <strong>📅 Follow-up Timeline:</strong>
                    <ul>
                        {interpretation.followUpPlan.map((p, idx) => <li key={idx}>{p}</li>)}
                    </ul>
                </div>

                <div className="care-section">
                    <strong>💊 Medication Adjustments:</strong>
                    <ul>
                        {interpretation.medicationAdjustments.map((m, idx) => <li key={idx}>{m}</li>)}
                    </ul>
                </div>

                <div className="care-section">
                    <strong>📡 Patient Monitoring:</strong>
                    <div className="monitoring-pills">
                        {interpretation.monitoringPlan.map((mp, idx) => <span key={idx} className="monitor-pill">{mp}</span>)}
                    </div>
                </div>
              </div>

              <div className="card tracking-card ivory-blue">
                <h3>🔔 Care Tracker (Closed-Loop)</h3>
                
                <div className="task-list">
                    <strong>✅ Care Tasks Checklist:</strong>
                    {interpretation.careTasks.map((task, idx) => (
                        <div key={idx} className="task-item">
                            <input type="checkbox" id={`task-${idx}`} />
                            <label htmlFor={`task-${idx}`}>
                                {task.task} <span className="task-meta">({task.due || task.duration})</span>
                            </label>
                        </div>
                    ))}
                </div>

                <div className="reminder-list">
                    <strong>📢 Patient Reminders:</strong>
                    <ul>
                        {interpretation.patientReminders.map((rem, idx) => <li key={idx}>{rem}</li>)}
                    </ul>
                </div>

                <div className="danger-zone">
                    <strong>🚨 DANGER SIGNS (Seek Emergency Care)</strong>
                    <div className="danger-grid">
                        {interpretation.escalationTriggers.map((trig, idx) => (
                            <div key={idx} className="danger-tri">{trig}</div>
                        ))}
                    </div>
                </div>
              </div>

              <div className="card compliance-card border-top-red">
                <h3>📊 Clinical Compliance Intelligence</h3>
                
                <div className="compliance-header">
                    <div className={`score-circle ${interpretation.complianceScore < 70 ? 'poor' : 'good'}`}>
                        {interpretation.complianceScore}%
                    </div>
                    <div className="score-label">
                        <h4>Care Adherence Score</h4>
                        <p>{interpretation.complianceScore < 70 ? '⚠️ Critical Gaps Detected' : '✅ On track'}</p>
                    </div>
                </div>

                {interpretation.complianceScore < 70 && (
                    <div className="compliance-alert">
                       <strong>HIGH RISK ALERT:</strong> Critical care tasks are overdue. Recurrent event risk is high.
                    </div>
                )}

                <div className="missed-tasks-section">
                    <strong>🚨 Missed Tasks & Associated Risks:</strong>
                    <div className="missed-grid">
                        {interpretation.missedRisks.map((mr, idx) => (
                            <div key={idx} className="missed-item">
                                <span className="m-task">{mr.task}</span>
                                <span className="m-risk">➡️ {mr.risk}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="execution-hooks">
                    <strong>⚡ One-Click Enforcement:</strong>
                    <div className="hook-buttons">
                        {interpretation.executionHooks.slice(0, 3).map((h, idx) => (
                            <button key={idx} className="btn-hook" onClick={() => alert(`Triggering: ${h.hook} for ${h.task}`)}>
                                {h.task.split(' ')[0]} {h.type === 'lab' ? '🧪' : '📅'}
                            </button>
                        ))}
                    </div>
                </div>
              </div>

              <div className="card ecosystem-card border-left-blue">
                <h3>🏥 Care Ecosystem & Referral</h3>
                
                <div className="ecosystem-section">
                    <strong>💊 Preferred Pharmacy & Brands (India):</strong>
                    <div className="pharmacy-grid">
                        {interpretation.pharmacyMap.map((p, idx) => (
                            <div key={idx} className="pharmacy-item">
                                <span className="p-generic">{p.generic} {p.dosage}</span>
                                <span className="p-brands">Brands: {p.brands.join(', ')}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="ecosystem-section">
                    <strong>👨‍⚕️ Specialist Referral:</strong>
                    <div className="referral-grid">
                        {interpretation.referralNetwork.map((ref, idx) => (
                            <div key={idx} className="referral-item">
                                <span className={`urgency-dot ${ref.urgency.toLowerCase()}`}></span>
                                <div className="ref-info">
                                    <strong>{ref.specialty} ({ref.urgency})</strong>
                                    <p>{ref.reason}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="ecosystem-section">
                    <strong>📄 Insurance Justification:</strong>
                    {interpretation.insuranceSupport.map((text, idx) => (
                        <div key={idx} className="insurance-box">
                            <p id={`ins-text-${idx}`}>{text}</p>
                            <button className="btn-copy" onClick={() => {
                                navigator.clipboard.writeText(text);
                                alert("Justification copied to clipboard!");
                            }}>Copy Justification</button>
                        </div>
                    ))}
                </div>
              </div>

              <div className="card communication-card border-top-blue">
                <h3>📤 Communication & Patient Outbound</h3>
                
                <div className="comm-section">
                    <strong>👤 Patient Friendly Summary:</strong>
                    <div className="patient-msg-box">
                        <p>{interpretation.patientMessage}</p>
                    </div>
                    <button className="btn-comm" onClick={() => alert("Simulating: SMS Sent to Patient!")}>
                        📤 Send to Patient
                    </button>
                </div>

                <div className="comm-section">
                    <strong>💬 WhatsApp Ready Message:</strong>
                    <div className="whatsapp-preview">
                        <pre>{interpretation.whatsappMessage}</pre>
                    </div>
                    <button className="btn-comm copy-wa" onClick={() => {
                        navigator.clipboard.writeText(interpretation.whatsappMessage);
                        alert("WhatsApp Message Copied!");
                    }}>
                        📋 Copy WhatsApp Message
                    </button>
                </div>

                <div className="comm-section">
                    <strong>🩺 Physician OPD Note:</strong>
                    <div className="doctor-note-box">
                        <p>{interpretation.doctorSummaryNote}</p>
                    </div>
                    <button className="btn-comm" onClick={() => {
                        navigator.clipboard.writeText(interpretation.doctorSummaryNote);
                        alert("Doctor Note Copied!");
                    }}>
                        🩺 Copy Doctor Note
                    </button>
                </div>
              </div>

            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default ReportInterpreter;
