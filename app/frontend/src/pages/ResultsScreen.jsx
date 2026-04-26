import ClinicalNotes from '../components/ClinicalNotes';
import { API_BASE_URL } from '../config';

export default function ResultsScreen({ result, onReset, user, silentMode, socket }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [clipboardTimer, setClipboardTimer] = useState(null);
  const [privacyMode, setPrivacyMode] = useState(localStorage.getItem('privacyMode') === 'true');
  const [overrideTriggered, setOverrideTriggered] = useState(false);
  const [overrideTime, setOverrideTime] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showHandover, setShowHandover] = useState(false);
  const [showRecheck, setShowRecheck] = useState(false);
  const [manualCopyText, setManualCopyText] = useState("");
  const [assignRole, setAssignRole] = useState('Doctor');
  const [assignTaskStr, setAssignTaskStr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [extAbg, setExtAbg] = useState({ ph: '', pco2: '', po2: '', hco3: '' });
  const [extSpo2, setExtSpo2] = useState('');
  const [extHr, setExtHr] = useState('');
  const [extRr, setExtRr] = useState('');
  const [valOverride, setValOverride] = useState(false);
  const [extCheck, setExtCheck] = useState({ awake: false, cough: false, leak: false, stable: false });
  const [checkedPathwaySteps, setCheckedPathwaySteps] = useState({});
  const [executionCompliance, setExecutionCompliance] = useState(null);
  const [slaAlerts, setSlaAlerts] = useState([]);
  const [clinicalSuggestion, setClinicalSuggestion] = useState(null);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeData, setDischargeData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [insuranceData, setInsuranceData] = useState(null);
  const [isGeneratingInsurance, setIsGeneratingInsurance] = useState(false);
  const [showManualCopy, setShowManualCopy] = useState(false);

  const API_BASE = API_BASE_URL;

  const downloadPDF = (type) => {
    if (!result || !result.caseId) return;
    const url = `${API_BASE}/api/clinical/pdf/${result.caseId}?type=${type}`;
    window.open(url, '_blank');
  };

  const allExtChecked = Object.values(extCheck).every(Boolean);

  useEffect(() => {
     const int = setInterval(() => setNow(Date.now()), 1000);
     return () => clearInterval(int);
  }, []);

  useEffect(() => {
   setCheckedPathwaySteps({});
     setExecutionCompliance(null);
     setSlaAlerts([]);
     setClinicalSuggestion(null);
  }, [result?.caseId, result?.ventilatorStatus?.predictiveIntel?.clinicalPathway?.pathwayKey]);

  useEffect(() => {
     const handleUpdate = (data) => {
        if (data.caseId === result?.caseId) {
           setExecutionCompliance(data.compliance);
        }
     };
     socket.on('pathway_execution_update', handleUpdate);
     return () => socket.off('pathway_execution_update', handleUpdate);
  }, [result?.caseId]);

  useEffect(() => {
      const handleSLABreach = (data) => {
         if (data.caseId === result?.caseId) {
            setSlaAlerts(prev => [{ ...data, id: Date.now() }, ...prev].slice(0, 3));
         }
      };
      const handlePoorCompliance = (data) => {
         if (data.caseId === result?.caseId) {
            setExecutionCompliance(prev => prev ? { ...prev, poorCompliance: true, complianceScore: data.complianceScore } : null);
         }
      };
      socket.on('sla_breach_critical', handleSLABreach);
      socket.on('poor_compliance_alert', handlePoorCompliance);
      return () => {
         socket.off('sla_breach_critical', handleSLABreach);
         socket.off('poor_compliance_alert', handlePoorCompliance);
      };
   }, [result?.caseId]);

   useEffect(() => {
      const handleSuggestion = (data) => {
         if (data.caseId === result?.caseId) {
            setClinicalSuggestion(data.suggestion);
         }
      };
      socket.on('suggestion_update', handleSuggestion);
      return () => socket.off('suggestion_update', handleSuggestion);
   }, [result?.caseId]);

  const handleCopy = () => {
    if (result && result.dischargeSummary) {
      if (!navigator.clipboard) {
         setManualCopyText(result.dischargeSummary);
         setShowManualCopy(true);
         return;
      }
      navigator.clipboard.writeText(result.dischargeSummary).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        
        setClipboardTimer(60);
        const countdown = setInterval(() => {
          setClipboardTimer((prev) => {
            if (prev <= 1) {
              clearInterval(countdown);
              navigator.clipboard?.writeText(" ");
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }).catch(() => {
         setManualCopyText(result.dischargeSummary);
         setShowManualCopy(true);
      });
    }
  };

  if (result.status === "SAFE_MODE") {
    return (
      <div className="fade-in">
        <h1 className="result-header critical">⚠️ CRITICAL SYSTEM FAULT</h1>
        <Card title="Medico-Legal System Override">
          <div style={{ backgroundColor: '#ffcccc', padding: '16px', borderRadius: '8px', borderLeft: '6px solid #d32f2f' }}>
            <h3 style={{ color: '#d32f2f', margin: 0, fontWeight: 700, fontSize: '20px' }}>⚠️ {result.message}</h3>
            {result.fallbackPlan && (
               <ul style={{ color: '#b71c1c', fontWeight: 600, marginTop: '12px' }}>
                 {result.fallbackPlan.map((step, idx) => <li key={idx}>{step}</li>)}
               </ul>
            )}
          </div>
        </Card>
        <div style={{ marginTop: 48, marginBottom: 64 }}>
          <Button size="large" onClick={onReset} variant="secondary">Evaluate New Patient</Button>
        </div>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="fade-in">
        <h1 className="result-header critical">⚠️ {result.error.includes("AUDIT ENGINE") ? "SYSTEM BLOCKED BY AUDIT ENGINE" : "DATA INSUFFICIENT"}</h1>
        <Card title="Medico-Legal System Block">
          <p style={{ color: "var(--color-danger)", fontSize: "16px", fontWeight: "500", padding: "16px" }}>
            {result.error || "The Clinical Decision Support System encountered unsafe contraindications, allergies, or missing mandatory data. All automated treatment protocols have been safely halted."}
          </p>
          {result.auditDetails && result.auditDetails.status === "REJECTED" && (
            <div style={{ margin: "0 16px 16px", padding: '12px', border: "1px solid #ffccbc", backgroundColor: "#fff3e0", borderRadius: "4px" }}>
              <h4 style={{ color: "#d84315", marginTop: 0 }}>Strict Audit Validation Failed:</h4>
              <ul style={{ color: "#bf360c", margin: 0, paddingLeft: "20px" }}>
                 {result.auditDetails.issues.map((issue, idx) => (
                   <li key={idx} style={{ marginBottom: "4px" }}>{issue}</li>
                 ))}
              </ul>
            </div>
          )}
        </Card>
        <div style={{ marginTop: 48, marginBottom: 64 }}>
          <Button size="large" onClick={onReset} variant="secondary">Evaluate New Patient</Button>
        </div>
      </div>
    );
  }

  const isCritical = result.primaryDiagnosis === 'STEMI' || result.severity === 'Critical';
  const isActuallyCritical = result.severity === 'Critical' || result.triageLevel === 'RED' || result.respiratoryStatus?.level === 'Severe';
  const pName = result.patientInfo?.name || "Unknown Patient";
  const pAge = result.patientInfo?.age || "--";
  const pGender = result.patientInfo?.gender || "--";

  const getInitials = (name) => {
    if (!name || name === "Unknown Patient") return "Unknown Patient";
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0] + ".";
    return parts[0][0] + "." + parts[parts.length - 1][0] + ". (Masked)";
  };
  const displayName = privacyMode ? getInitials(pName) : pName;

  const togglePrivacy = () => {
    const newVal = !privacyMode;
    setPrivacyMode(newVal);
    localStorage.setItem('privacyMode', newVal);
  };

  useEffect(() => {
    if (!result || !result.localTimestamp) return;
    setTimeElapsed(0);
    const interval = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - result.localTimestamp) / 60000));
    }, 60000);
    return () => clearInterval(interval);
  }, [result]);

  useEffect(() => {
    if (!isActuallyCritical) return;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      setShowRecheck(false);
      timer = setTimeout(() => {
        setShowRecheck(true);
      }, 10 * 60 * 1000); 
    };
    
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [isActuallyCritical]);

  useEffect(() => {
    if (isActuallyCritical) return;
    let idleTimer;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        alert("Session cleared due to inactivity");
        localStorage.removeItem("clinicalDraft");
        onReset();
      }, 15 * 60 * 1000); // 15 mins
    };
    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('click', resetIdle);
    resetIdle();
    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('click', resetIdle);
    };
  }, [isActuallyCritical, onReset]);


  useEffect(() => {
    if (isActuallyCritical) {
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = "You are leaving a critical patient. Confirm?";
        return "You are leaving a critical patient. Confirm?";
      };
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  }, [isActuallyCritical]);

  const handleEvaluateNew = () => {
    if (isActuallyCritical) {
      if (!window.confirm("You are leaving a critical patient. Confirm?")) {
        return;
      }
    } else {
      if (!window.confirm("Start new patient?\n(This will clear the current draft form)")) {
        return;
      }
    }
    localStorage.removeItem("clinicalDraft");
    onReset();
  };

  const handleOverride = () => {
    if (window.confirm("Confirm manual override? You are bypassing system guidance")) {
      setOverrideTriggered(true);
      setOverrideTime(new Date().toLocaleTimeString());
    }
  };

  const handleGenerateOfficialDischarge = async () => {
     setIsGenerating(true);
     try {
        const res = await fetch(`/api/clinical/discharge/${result.caseId}`, {
           headers: { 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` }
        });
        if (!res.ok) throw new Error("Failed to reach engine");
        const data = await res.json();
        setDischargeData(data);
        setShowDischargeModal(true);
     } catch (e) {
        alert("Error generating summary: " + e.message);
     } finally {
        setIsGenerating(false);
     }
  };

  const handleGenerateInsuranceReport = async () => {
     setIsGeneratingInsurance(true);
     try {
        const res = await fetch(`/api/clinical/insurance/${result.caseId}`, {
           headers: { 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` }
        });
        const data = await res.json();
        
        if (res.status === 422) {
           alert("REJECTED: " + data.message);
           return;
        }
        
        if (!res.ok) throw new Error("Failed to reach engine");
        
        setInsuranceData(data);
        setShowInsuranceModal(true);
     } catch (e) {
        alert("Error generating insurance report: " + e.message);
     } finally {
        setIsGeneratingInsurance(false);
     }
  };

  return (
    <div className="fade-in" style={isActuallyCritical && !silentMode ? { border: '3px solid #d32f2f', padding: '16px', borderRadius: '12px', animation: 'pulse-red 2s ease-out 3' } : isActuallyCritical ? { border: '3px solid #d32f2f', padding: '16px', borderRadius: '12px' } : {}}>
      <style>{`
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.3); }
          50% { box-shadow: 0 0 0 10px rgba(211, 47, 47, 0); }
          100% { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0); }
        }
      `}</style>

      {showRecheck && (
        <div onClick={() => setShowRecheck(false)} style={{ position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#d32f2f', color: '#fff', padding: '20px 40px', borderRadius: '40px', boxShadow: '0 8px 16px rgba(211,47,47,0.5)', zIndex: 10000, fontWeight: 'bold', fontSize: '20px', cursor: 'pointer', animation: silentMode ? 'none' : 'pulse-red 1.5s infinite', border: '2px solid #fff' }}>
          ⚠️ RECHECK PATIENT STATUS
        </div>
      )}

      {copied && (
        <div style={{ position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#323232', color: '#fff', padding: '12px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10000, fontWeight: 500, letterSpacing: '0.5px' }}>
          Copied to clipboard
        </div>
      )}

      {clipboardTimer && (
        <div style={{ position: 'fixed', top: '80px', right: '16px', backgroundColor: '#fff', color: '#e65100', border: '2px solid #e65100', padding: '12px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10000, fontWeight: 700 }}>
          ⚠️ Clipboard auto-clearing in {clipboardTimer}s
        </div>
      )}

      {isActuallyCritical && (
        <div style={{ backgroundColor: '#d32f2f', color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: '24px', padding: '12px', borderRadius: '8px', marginBottom: '24px', letterSpacing: '2px' }}>
          🚨 CRITICAL PATIENT 🚨
        </div>
      )}

      {/* Patient Tracking Banner */}
      <div style={{ backgroundColor: 'var(--code-bg)', padding: '12px 24px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>👤 {displayName}</span>
            <button onClick={togglePrivacy} style={{ padding: '4px 12px', borderRadius: '12px', border: `1px solid ${privacyMode ? '#c62828' : '#e0e0e0'}`, backgroundColor: privacyMode ? '#ffebee' : '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: privacyMode ? '#c62828' : '#757575', transition: 'all 0.2s' }}>
               {privacyMode ? '🔒 Privacy ON' : '🔓 Privacy OFF'}
            </button>
         </div>
         <div style={{ fontSize: '16px', color: 'var(--color-primary)', fontWeight: 500, border: '1px solid var(--border)', padding: '4px 12px', borderRadius: '16px', backgroundColor: 'var(--color-background)' }}>
            {pAge} yrs | {pGender} {privacyMode ? '' : `| MRD: ${result.patientInfo?.mrd || '--'}`}
         </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '24px', fontWeight: 500, padding: '0 8px' }}>
         <span>🕒 Case Age: {timeElapsed} min</span>
         {result.localTimestamp && <span>Last updated: {new Date(result.localTimestamp).toLocaleTimeString()}</span>}
      </div>

      {/* NEW ASSIGNED TASKS BLOCK */}
      <Card title="📌 Task Delegation & Responsibilities">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
           <select value={assignRole} onChange={e => setAssignRole(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#fff', fontSize: '14px' }}>
              <option value="Doctor">Doctor</option>
              <option value="Nurse">Nurse</option>
              <option value="Consultant">Consultant</option>
           </select>
           <select value={assignTaskStr} onChange={e => setAssignTaskStr(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', flex: 1, backgroundColor: '#fff', fontSize: '14px' }}>
              <option value="">Select Quick Task...</option>
              <option value="Start oxygen">Start oxygen</option>
              <option value="Shift to ICU">Shift to ICU</option>
              <option value="Call cardiology">Call cardiology</option>
              <option value="Prepare intubation">Prepare intubation</option>
              <option value="Arrange CT">Arrange CT</option>
              <option value="IV fluids">IV fluids</option>
           </select>
           <Button onClick={() => {
              if (assignTaskStr) {
                 socket.emit("assign_task", { caseId: result.caseId, assignedTo: assignRole, user: user, task: assignTaskStr });
                 setAssignTaskStr('');
              }
           }} style={{ padding: '8px 24px' }}>Assign Task</Button>
        </div>
        
        {result.tasks && result.tasks.length > 0 ? (
           <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
              {result.tasks.map(t => (
                 <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: t.status === 'pending' ? '#fff3e0' : '#e8f5e9', padding: '12px 16px', borderRadius: '8px', marginBottom: '8px', borderLeft: `6px solid ${t.status === 'pending' ? '#ff9800' : '#4caf50'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div>
                       <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#333' }}>{t.task} <span style={{ color: '#757575', fontWeight: 600, fontSize: '13px' }}>(Assigned to: {t.assignedTo})</span></div>
                       <div style={{ fontSize: '12px', color: '#9e9e9e', marginTop: '4px' }}>Issued by {t.assignedBy?.name || t.assignedBy} at {new Date(t.createdAt).toLocaleTimeString()}</div>
                    </div>
                    {t.status === 'pending' ? (
                       <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                           {(() => {
                              const diff = t.dueBy - now;
                              const totalSla = t.dueBy - t.createdAt;
                              const isAtRisk = diff <= (totalSla * 0.3) && diff > 0;
                              
                              if (diff <= 0) return (
                                <>
                                   <span style={{ fontWeight: 'bold', color: '#d32f2f', fontSize: '14px', animation: 'pulse-white 1s infinite' }}>⏰ OVERDUE</span>
                                   <span style={{ fontWeight: 'bold', color: '#d32f2f', fontSize: '14px' }}>🔴 Overdue</span>
                                </>
                              );
                              
                              const mins = Math.floor(diff / 60000);
                              const secs = Math.floor((diff % 60000) / 1000);
                              
                              return (
                                <>
                                   <span style={{ fontWeight: 'bold', color: isAtRisk ? '#fbc02d' : '#1976d2', fontSize: '14px' }}>⏳ {mins}:{secs.toString().padStart(2, '0')}</span>
                                   <span style={{ fontWeight: 'bold', color: isAtRisk ? '#fbc02d' : '#e65100', fontSize: '14px' }}>{isAtRisk ? '🟡 AT RISK' : '🟡 Pending'}</span>
                                </>
                              );
                           })()}
                           <Button onClick={() => socket.emit("complete_task", { caseId: result.caseId, taskId: t.id, user })} style={{ backgroundColor: '#4caf50', border: 'none', color: '#fff', fontSize: '13px', padding: '6px 12px' }}>Mark Complete</Button>
                       </div>
                    ) : (
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 'bold', color: '#2e7d32', fontSize: '14px' }}>✅ Completed ({new Date(t.completedAt).toLocaleTimeString()})</span>
                          {t.completedBy && <span style={{fontSize:'12px', color:'#757575'}}>by {t.completedBy.name}</span>}
                       </div>
                    )}
                 </li>
              ))}
           </ul>
        ) : (
           <div style={{ color: '#9e9e9e', fontStyle: 'italic', padding: '8px 0', fontSize: '14px' }}>No active tasks routed to this patient.</div>
        )}
      </Card>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
         <Button onClick={() => setShowHandover(true)} variant="secondary" style={{ flex: 1, backgroundColor: '#e3f2fd', color: '#1565c0', borderColor: '#90caf9' }}>📋 Generate Handover Summary</Button>
         <Button 
            onClick={handleGenerateOfficialDischarge} 
            disabled={isGenerating}
            variant="primary" 
            style={{ flex: 1, backgroundColor: '#1b5e20', color: '#fff', borderColor: '#1b5e20' }}
         >
            {isGenerating ? "⏳ Generating..." : "📄 Generate Medico-Legal Discharge (v2)"}
         </Button>
         <Button 
            onClick={handleGenerateInsuranceReport} 
            disabled={isGeneratingInsurance}
            variant="primary" 
            style={{ flex: 1, backgroundColor: '#e65100', color: '#fff', borderColor: '#e65100' }}
         >
            {isGeneratingInsurance ? "⏳ Generating..." : "💰 Generate Insurance Report"}
         </Button>
      </div>

      {/* Huge One Line Summary Header */}
      <h1 className={`result-header ${isCritical ? 'critical' : 'normal'}`}>
        {result.oneLineSummary || result.primaryDiagnosis}
      </h1>

      {/* Ventilator Support Block */}
      {result.ventilatorStatus && (
         <Card style={{ marginBottom: '32px', borderLeft: '6px solid #009688', backgroundColor: '#e0f2f1', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
               <div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#00695c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     🫁 Ventilator Decision Support
                     <span style={{ fontSize: '13px', backgroundColor: '#80cbc4', color: '#004d40', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                        {result.ventilatorStatus.state}
                     </span>
                  </h3>
                  {result.ventilatorStatus.settings.interpretation && (
                     <div style={{ fontSize: '14px', color: '#004d40', fontWeight: 'bold' }}>
                        ABG Analysis: <span style={{ backgroundColor: '#b2dfdb', padding: '2px 6px', borderRadius: '4px' }}>{result.ventilatorStatus.settings.interpretation}</span>
                     </div>
                  )}
               </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
               <div style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #b2dfdb' }}>
                  <div style={{ fontSize: '12px', color: '#00695c', fontWeight: 'bold', marginBottom: '4px' }}>MODE</div>
                  <div style={{ fontSize: '15px', color: '#333', fontWeight: 'bold' }}>{result.ventilatorStatus.settings.mode}</div>
               </div>
               <div style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #b2dfdb' }}>
                  <div style={{ fontSize: '12px', color: '#00695c', fontWeight: 'bold', marginBottom: '4px' }}>TIDAL VOLUME</div>
                  <div style={{ fontSize: '15px', color: '#333', fontWeight: 'bold' }}>{result.ventilatorStatus.settings.tidalVolume}</div>
               </div>
               <div style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #b2dfdb' }}>
                  <div style={{ fontSize: '12px', color: '#00695c', fontWeight: 'bold', marginBottom: '4px' }}>RESP RATE</div>
                  <div style={{ fontSize: '15px', color: '#333', fontWeight: 'bold' }}>{result.ventilatorStatus.settings.RR}</div>
               </div>
               <div style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #b2dfdb' }}>
                  <div style={{ fontSize: '12px', color: '#00695c', fontWeight: 'bold', marginBottom: '4px' }}>PEEP</div>
                  <div style={{ fontSize: '15px', color: '#333', fontWeight: 'bold' }}>{result.ventilatorStatus.settings.PEEP} cmH2O</div>
               </div>
               <div style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #b2dfdb' }}>
                  <div style={{ fontSize: '12px', color: '#00695c', fontWeight: 'bold', marginBottom: '4px' }}>FiO2</div>
                  <div style={{ fontSize: '15px', color: '#e65100', fontWeight: 'bold' }}>{result.ventilatorStatus.settings.FiO2}</div>
               </div>
            </div>
            
            {/* Weaning Panel */}
            {(result.ventilatorStatus?.settings?.weaning?.isWeaningReady || result.ventilatorStatus?.sbt) && (
               <div style={{ marginBottom: '16px', borderLeft: '6px solid #1976d2', backgroundColor: '#e3f2fd', padding: '16px', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#0d47a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     🫁 ICU Weaning Protocol
                     <span style={{ fontSize: '12px', backgroundColor: '#bbdefb', color: '#0d47a1', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                        {result.ventilatorStatus?.sbt?.state || 'READY'}
                     </span>
                  </h4>
                  
                  {!result.ventilatorStatus?.sbt || result.ventilatorStatus.sbt.state === 'READY' ? (
                      <>
                         <div style={{ color: '#1565c0', fontWeight: 'bold', marginBottom: '8px', fontSize: '15px' }}>{result.ventilatorStatus.settings.weaning.recommendation}</div>
                         <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px', color: '#0d47a1', fontWeight: 500, fontSize: '13px', lineHeight: 1.6 }}>
                            {result.ventilatorStatus.settings.weaning.checklist.map((c, idx) => <li key={idx}>✅ {c}</li>)}
                         </ul>
                         <Button onClick={() => socket.emit('start_sbt', { caseId: result.caseId, user })} style={{ backgroundColor: '#1565c0', fontWeight: 'bold', border: 'none' }}>Start SBT Now</Button>
                      </>
                  ) : result.ventilatorStatus.sbt.state === 'IN_PROGRESS' ? (
                      <div style={{ padding: '12px', backgroundColor: '#fff3e0', borderLeft: '4px solid #f57c00', borderRadius: '6px' }}>
                         <div style={{ fontSize: '15px', color: '#e65100', fontWeight: 'bold' }}>🟡 Trial in progress</div>
                         <div style={{ fontSize: '13px', marginTop: '6px', color: '#e65100', fontWeight: 600 }}>SBT Elapsed Duration: {Math.floor((now - result.ventilatorStatus.sbt.startTime) / 60000)} minutes</div>
                         <div style={{ marginTop: '8px', fontSize: '12px', color: '#757575', fontStyle: 'italic' }}>Update Vitals sequentially to monitor SBT physiological response.</div>
                      </div>
                  ) : result.ventilatorStatus.sbt.state === 'FAILED' ? (
                      <div style={{ padding: '12px', backgroundColor: '#ffebee', borderLeft: '4px solid #d32f2f', borderRadius: '6px' }}>
                         <div style={{ fontSize: '15px', color: '#c62828', fontWeight: 'bold' }}>❌ Failed</div>
                         <div style={{ fontSize: '13px', marginTop: '6px', color: '#d32f2f', fontWeight: 'bold' }}>{result.ventilatorStatus.sbt.failureReason}</div>
                      </div>
                  ) : result.ventilatorStatus.sbt.state === 'SUCCESS' ? (
                      <div style={{ padding: '12px', backgroundColor: '#e8f5e9', borderLeft: '4px solid #2e7d32', borderRadius: '6px' }}>
                         <div style={{ fontSize: '15px', color: '#1b5e20', fontWeight: 'bold' }}>✅ Success</div>
                         <div style={{ fontSize: '13px', marginTop: '6px', color: '#2e7d32', fontWeight: 600 }}>{result.ventilatorStatus.sbt.successMessage}</div>
                         
                         {result.ventilatorStatus.sbt.extubationRisk && (
                            <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fff', border: '1px solid #c8e6c9', borderRadius: '6px' }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: result.ventilatorStatus.sbt.extubationRisk.level === 'HIGH' ? '#c62828' : '#2e7d32' }}>
                                    {result.ventilatorStatus.sbt.extubationRisk.recommendation}
                                </div>
                                {result.ventilatorStatus.sbt.extubationRisk.factors.length > 0 && (
                                    <div style={{ fontSize: '12px', marginTop: '6px', color: '#616161' }}>
                                        <strong>⚠️ Risk Factors Detected:</strong> {result.ventilatorStatus.sbt.extubationRisk.factors.join(', ')}
                                    </div>
                                )}
                                <div style={{ fontSize: '12px', marginTop: '10px', color: '#757575', fontStyle: 'italic', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                                    {result.ventilatorStatus.sbt.extubationRisk.safety}
                                </div>
                            </div>
                         )}
                         
                         <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fff', border: '1px solid #c8e6c9', borderRadius: '6px' }}>
                            <h5 style={{ margin: '0 0 10px 0', color: '#1b5e20', fontSize: '14px' }}>📋 Mandatory Pre-Extubation Checklist</h5>
                            {['awake', 'cough', 'leak', 'stable'].map(item => (
                                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <input type="checkbox" checked={extCheck[item]} onChange={e => setExtCheck({...extCheck, [item]: e.target.checked})} id={item} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                    <label htmlFor={item} style={{ fontSize: '13px', color: '#424242', cursor: 'pointer', userSelect: 'none', fontWeight: 500 }}>
                                        {item === 'awake' ? 'Patient awake and following commands' : 
                                         item === 'cough' ? 'Strong cough / manageable secretions' : 
                                         item === 'leak' ? 'Cuff leak present (no airway edema)' : 
                                         'Hemodynamically stable (no active ischemia / shock)'}
                                    </label>
                                </div>
                            ))}
                            <Button 
                                disabled={!allExtChecked} 
                                onClick={() => socket.emit('execute_extubation', { caseId: result.caseId, user })}
                                style={{ marginTop: '12px', backgroundColor: allExtChecked ? '#2e7d32' : '#bdbdbd', color: '#fff', width: '100%', fontWeight: 'bold', padding: '10px', border: 'none' }}>
                                Confirm & Extubate Patient
                            </Button>
                         </div>
                         
                      </div>
                  ) : result.ventilatorStatus.sbt.state === 'EXTUBATED' ? (
                      <div style={{ padding: '12px', backgroundColor: '#e0f7fa', borderLeft: '4px solid #00ACC1', borderRadius: '6px' }}>
                         <div style={{ fontSize: '15px', color: '#00838f', fontWeight: 'bold' }}>🌬️ Patient Extubated</div>
                         <div style={{ fontSize: '13px', marginTop: '6px', color: '#006064', fontWeight: 600 }}>Extubation approved by: Dr. {result.ventilatorStatus.sbt.extubatedBy?.name}</div>
                         
                         {result.ventilatorStatus.postExtubation && (
                            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fff', border: '1px solid #b2ebf2', borderRadius: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                   <div style={{ padding: '6px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold', 
                                      backgroundColor: result.ventilatorStatus.postExtubation.status === 'FAILED' ? '#ffebee' : result.ventilatorStatus.postExtubation.status === 'AT RISK' ? '#fff3e0' : result.ventilatorStatus.postExtubation.status === 'SUCCESS' ? '#e8f5e9' : '#e0f2f1',
                                      color: result.ventilatorStatus.postExtubation.status === 'FAILED' ? '#c62828' : result.ventilatorStatus.postExtubation.status === 'AT RISK' ? '#ef6c00' : result.ventilatorStatus.postExtubation.status === 'SUCCESS' ? '#2e7d32' : '#00695c'
                                   }}>
                                      {result.ventilatorStatus.postExtubation.status === 'FAILED' ? '🔴 FAILURE' : result.ventilatorStatus.postExtubation.status === 'AT RISK' ? '🟡 AT RISK' : result.ventilatorStatus.postExtubation.status === 'SUCCESS' ? '🟢 SUCCESS' : '🟢 STABLE'}
                                   </div>
                                   <div style={{ fontSize: '12px', color: '#00838f', fontWeight: 'bold' }}>
                                       {result.ventilatorStatus.postExtubation.timeSinceExtubation} mins post-extubation window
                                   </div>
                                </div>
                                
                                {result.ventilatorStatus.postExtubation.alerts?.length > 0 && (
                                   <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', color: result.ventilatorStatus.postExtubation.status === 'FAILED' ? '#c62828' : '#e65100', fontSize: '13px', fontWeight: 600 }}>
                                      {result.ventilatorStatus.postExtubation.alerts.map((a, i) => <li key={i}>{a}</li>)}
                                   </ul>
                                )}
                                
                                {result.ventilatorStatus.postExtubation.recs?.length > 0 && (
                                   <div style={{ backgroundColor: '#fff3e0', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #ff9800', fontSize: '13px', color: '#e65100', fontWeight: 'bold' }}>
                                      {result.ventilatorStatus.postExtubation.recs.join(' | ')}
                                   </div>
                                )}
                            </div>
                         )}
                      </div>
                  ) : null}
                  
                  <div style={{ marginTop: '16px', fontSize: '11px', color: '#9e9e9e', textAlign: 'center', fontStyle: 'italic', borderTop: '1px dashed #bbdefb', paddingTop: '12px' }}>
                     Extubation decision requires clinical judgment & physician presence.
                  </div>
               </div>
            )}
            
      {/* Latest Vitals Summary Card */}
      {result.vitalHistory && result.vitalHistory.length > 0 && (() => {
         const latest = result.vitalHistory[result.vitalHistory.length - 1];
         return (
            <Card title="🫀 Inpatient Vitals Summary (Latest)" style={{ marginBottom: '16px' }}>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '16px' }}>
                  <div style={{ textAlign: 'center' }}>
                     <div style={{ fontSize: '12px', color: '#757575', fontWeight: 'bold' }}>SpO2</div>
                     <div style={{ fontSize: '24px', fontWeight: 'bold', color: latest.spo2 < 90 ? '#d32f2f' : '#2e7d32' }}>{latest.spo2}%</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                     <div style={{ fontSize: '12px', color: '#757575', fontWeight: 'bold' }}>RR</div>
                     <div style={{ fontSize: '24px', fontWeight: 'bold', color: latest.rr > 25 ? '#d32f2f' : '#333' }}>{latest.rr}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                     <div style={{ fontSize: '12px', color: '#757575', fontWeight: 'bold' }}>HR</div>
                     <div style={{ fontSize: '24px', fontWeight: 'bold', color: latest.hr > 110 ? '#d32f2f' : '#333' }}>{latest.hr}</div>
                  </div>
                  {latest.abg && (
                     <>
                        <div style={{ textAlign: 'center' }}>
                           <div style={{ fontSize: '12px', color: '#757575', fontWeight: 'bold' }}>pH</div>
                           <div style={{ fontSize: '24px', fontWeight: 'bold', color: latest.abg.ph < 7.35 || latest.abg.ph > 7.45 ? '#d32f2f' : '#333' }}>{latest.abg.ph}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                           <div style={{ fontSize: '12px', color: '#757575', fontWeight: 'bold' }}>PaCO2</div>
                           <div style={{ fontSize: '24px', fontWeight: 'bold', color: latest.abg.pco2 > 45 ? '#d32f2f' : '#333' }}>{latest.abg.pco2}</div>
                        </div>
                     </>
                  )}
               </div>
            </Card>
         );
      })()}

      {/* Predictive Intelligence Panel - Now as its own card below Vitals */}
      {result.ventilatorStatus?.predictiveIntel && (() => {
         const intel = result.ventilatorStatus.predictiveIntel;
         const riskColor = intel.predictedRisk === 'HIGH' ? '#d32f2f' : intel.predictedRisk === 'MODERATE' ? '#f57c00' : '#388e3c';
         const riskBg   = intel.predictedRisk === 'HIGH' ? '#ffebee' : intel.predictedRisk === 'MODERATE' ? '#fff3e0' : '#e8f5e9';
         
         // Scale score to 0-100 (based on max expected clinical score of 6)
         const scaledScore = Math.min(Math.round((intel.riskScore / 6) * 100), 100);
         const barPct   = scaledScore;

         const vitalConfig = [
            { key: 'SpO2',  label: 'SpO2',   unit: '%',   worseArrow: '↓', emoji: '🫧' },
            { key: 'RR',    label: 'RR',     unit: '/min', worseArrow: '↑', emoji: '💨' },
            { key: 'HR',    label: 'HR',     unit: 'bpm',  worseArrow: '↑', emoji: '❤️' },
            { key: 'PaCO2', label: 'PaCO2',  unit: '',     worseArrow: '↑', emoji: '🫁' },
            { key: 'pH',    label: 'pH',     unit: '',     worseArrow: '↓', emoji: '🧪' },
         ];

         const history = result.vitalHistory || [];
         const lastReadings = history.slice(-5);

         const arrowColor = (vital, arrow) => {
            if (arrow === '→') return '#9e9e9e';
            return arrow === vital.worseArrow ? '#d32f2f' : '#2e7d32';
         };

         return (
            <Card title="📊 Predictive Deterioration Panel" style={{ marginBottom: '32px', borderLeft: `8px solid ${riskColor}` }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: riskColor }}>
                     {intel.predictedRisk} RISK DETECTED
                  </div>
                  <div style={{ textAlign: 'right' }}>
                     <div style={{ fontSize: '24px', fontWeight: '900', color: riskColor }}>{scaledScore}</div>
                     <div style={{ fontSize: '10px', color: '#9e9e9e', fontWeight: 'bold' }}>RISK INDEX (0-100)</div>
                  </div>
               </div>

               {/* Risk score bar */}
               <div style={{ marginBottom: '24px' }}>
                  <div style={{ width: '100%', height: '12px', backgroundColor: '#eeeeee', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
                     <div style={{ height: '100%', width: `${barPct}%`, backgroundColor: riskColor, borderRadius: '6px', transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9e9e9e', marginTop: '6px', fontWeight: 700 }}>
                     <span>LOW</span><span>MODERATE</span><span>HIGH</span>
                  </div>
               </div>

               {/* Per-vital trend arrows - Large UI */}
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  {vitalConfig.map(vital => {
                     const arrow = intel.trends?.[vital.key] || '→';
                     const color = arrowColor(vital, arrow);
                     const isWorse = arrow === vital.worseArrow;
                     return (
                        <div key={vital.key} style={{
                           padding: '16px 12px',
                           borderRadius: '12px',
                           backgroundColor: isWorse ? '#fff5f5' : arrow === '→' ? '#fafafa' : '#f1faf2',
                           border: `2px solid ${isWorse ? '#ffcdd2' : arrow === '→' ? '#e0e0e0' : '#c8e6c9'}`,
                           textAlign: 'center',
                           boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                           <div style={{ fontSize: '20px', marginBottom: '4px' }}>{vital.emoji}</div>
                           <div style={{ fontSize: '12px', color: '#616161', fontWeight: 800 }}>{vital.label}</div>
                           <div style={{ fontSize: '32px', fontWeight: 900, color, lineHeight: 1.2 }}>{arrow}</div>
                           <div style={{ fontSize: '11px', color, fontWeight: 700, marginTop: '4px' }}>
                              {isWorse ? 'WORSENING' : arrow === '→' ? 'STABLE' : 'IMPROVING'}
                           </div>
                        </div>
                     );
                  })}
               </div>

               {/* Mini reading history strip */}
               {lastReadings.length >= 2 && (
                  <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fcfcfc', borderRadius: '8px', border: '1px solid #eee' }}>
                     <div style={{ fontSize: '11px', color: '#9e9e9e', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trend History (Last {lastReadings.length} readings)</div>
                     <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: '13px', width: '100%' }}>
                           <thead>
                              <tr style={{ color: '#757575', borderBottom: '1px solid #eee' }}>
                                 <td style={{ padding: '6px' }}>Reading</td>
                                 <td style={{ padding: '6px' }}>SpO2</td>
                                 <td style={{ padding: '6px' }}>RR</td>
                                 <td style={{ padding: '6px' }}>PaCO2</td>
                                 <td style={{ padding: '6px' }}>pH</td>
                              </tr>
                           </thead>
                           <tbody>
                              {lastReadings.map((r, i) => (
                                 <tr key={i} style={{ backgroundColor: i === lastReadings.length - 1 ? '#f0f7ff' : 'transparent' }}>
                                    <td style={{ padding: '6px', color: '#9e9e9e' }}>T-{lastReadings.length - 1 - i}</td>
                                    <td style={{ padding: '6px', fontWeight: 600 }}>{r.spo2}%</td>
                                    <td style={{ padding: '6px', fontWeight: 600 }}>{r.rr}</td>
                                    <td style={{ padding: '6px', fontWeight: 600 }}>{r.abg?.pco2 || '–'}</td>
                                    <td style={{ padding: '6px', fontWeight: 600 }}>{r.abg?.ph || '–'}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               )}

               {/* Recommendation */}
               <div style={{ backgroundColor: riskBg, padding: '16px', borderRadius: '8px', fontSize: '14px', color: riskColor, fontWeight: '800', borderLeft: `6px solid ${riskColor}`, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                  ⚠️ {intel.recommendation}
               </div>

               <div style={{ marginTop: '12px', fontSize: '11px', color: '#bdbdbd', fontStyle: 'italic', textAlign: 'center' }}>
                  Physiologic trend engine monitoring SpO2, RR, HR, and ABG dynamics.
               </div>
            </Card>
         );
      })()}



            
            {result.ventilatorStatus.settings.warnings && result.ventilatorStatus.settings.warnings.length > 0 && (
               <div style={{ padding: '12px', backgroundColor: '#ffebee', borderRadius: '8px', borderLeft: '4px solid #d32f2f', marginBottom: '16px', fontSize: '14px', color: '#b71c1c' }}>
                  <strong>Safety Parameter Matrix:</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                     {result.ventilatorStatus.settings.warnings.map((w, idx) => <li key={idx}>{w}</li>)}
                  </ul>
               </div>
            )}
            
            {result.ventilatorStatus.responseTracking && (
               <div style={{ padding: '16px', backgroundColor: '#e8f5e9', borderRadius: '8px', borderLeft: '4px solid #4caf50', marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32' }}>📈 Response Tracking</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '13px' }}>
                      <div style={{ backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #c8e6c9' }}>
                         <span style={{ color: '#bdbdbd', display: 'block', fontSize: '11px', fontWeight: 'bold' }}>STATUS</span>
                         <strong style={{ color: result.ventilatorStatus.responseTracking.responseStatus === 'Worsening' ? '#d32f2f' : '#2e7d32' }}>{result.ventilatorStatus.responseTracking.responseStatus}</strong>
                      </div>
                      <div style={{ backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #c8e6c9' }}>
                         <span style={{ color: '#bdbdbd', display: 'block', fontSize: '11px', fontWeight: 'bold' }}>OXYGENATION</span>
                         <strong>{result.ventilatorStatus.responseTracking.oxygenationTrend}</strong>
                      </div>
                      <div style={{ backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #c8e6c9' }}>
                         <span style={{ color: '#bdbdbd', display: 'block', fontSize: '11px', fontWeight: 'bold' }}>VENTILATION</span>
                         <strong>{result.ventilatorStatus.responseTracking.ventilationTrend}</strong>
                      </div>
                  </div>
                  {result.ventilatorStatus.responseTracking.warnings?.length > 0 && (
                     <div style={{ color: '#d32f2f', fontWeight: 'bold', marginTop: '12px', fontSize: '13px', backgroundColor: '#ffebee', padding: '8px', borderRadius: '6px' }}>
                        {result.ventilatorStatus.responseTracking.warnings.join(' | ')}
                     </div>
                  )}
               </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px dashed #b2dfdb', paddingTop: '16px' }}>
               {result.ventilatorStatus.state === 'SUGGESTED' && (
                  user.role === 'consultant' ? (
                     <Button onClick={() => socket.emit('approve_vent', { caseId: result.caseId, user })} style={{ backgroundColor: '#00695c', border: 'none', color: '#fff', fontWeight: 'bold', padding: '12px 24px', width: '100%', fontSize: '16px' }}>Approve Clinical Settings</Button>
                  ) : (
                     <div style={{ color: '#004d40', fontWeight: 'bold', backgroundColor: '#b2dfdb', padding: '8px 16px', borderRadius: '24px', flex: 1, textAlign: 'center' }}>⏳ Awaiting Consultant Approval</div>
                  )
               )}
               {result.ventilatorStatus.state === 'APPROVED' && (
                  (user.role === 'doctor' || user.role === 'nurse') ? (
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '16px' }}>
                        <div style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '14px', flex: 1, textAlign: 'center' }}>⚠️ Clinical confirmation required prior to nodal entry</div>
                        <Button onClick={() => socket.emit('apply_vent', { caseId: result.caseId, user })} style={{ backgroundColor: '#d32f2f', border: 'none', color: '#fff', fontWeight: 'bold', padding: '12px 24px' }}>Execute Ventilator Settings</Button>
                     </div>
                  ) : (
                     <div style={{ color: '#004d40', fontWeight: 'bold', backgroundColor: '#b2dfdb', padding: '8px 16px', borderRadius: '24px', flex: 1, textAlign: 'center' }}>⏳ Verification Pending at Bedside Node</div>
                  )
               )}
               {result.ventilatorStatus.state === 'APPLIED' && (
                  <div style={{ color: '#2e7d32', fontWeight: 600, fontSize: '14px', backgroundColor: '#c8e6c9', padding: '12px', borderRadius: '8px', flex: 1, border: '1px solid #81c784' }}>
                     ✅ Node synced. Approved by: <strong>Dr. {result.ventilatorStatus.approvedBy?.name}</strong> | Applied by: <strong>{result.ventilatorStatus.appliedBy?.name}</strong>
                  </div>
               )}
            </div>
         </Card>
      )}

      {/* Update Clinical Vitals Form */}
      <Card style={{ marginBottom: '32px' }}>
         <h3 style={{ margin: '0 0 16px 0', color: '#1565c0' }}>🔄 Follow-up Arterial Blood Gas (ABG) & Vitals</h3>
         <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
               <label style={{display:'block', fontSize:'12px', fontWeight:'bold', color:'#757575'}}>pH</label>
               <input value={extAbg.ph} onChange={e => setExtAbg({...extAbg, ph: e.target.value})} style={{ width: '80px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
               <label style={{display:'block', fontSize:'12px', fontWeight:'bold', color:'#757575'}}>PaCO2</label>
               <input value={extAbg.pco2} onChange={e => setExtAbg({...extAbg, pco2: e.target.value})} style={{ width: '80px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
               <label style={{display:'block', fontSize:'12px', fontWeight:'bold', color:'#757575'}}>PaO2</label>
               <input value={extAbg.po2} onChange={e => setExtAbg({...extAbg, po2: e.target.value})} style={{ width: '80px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
               <label style={{display:'block', fontSize:'12px', fontWeight:'bold', color:'#757575'}}>HCO3</label>
               <input value={extAbg.hco3} onChange={e => setExtAbg({...extAbg, hco3: e.target.value})} style={{ width: '80px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
               <label style={{display:'block', fontSize:'12px', fontWeight:'bold', color:'#757575'}}>SpO2 (%)</label>
               <input value={extSpo2} onChange={e => setExtSpo2(e.target.value)} style={{ width: '80px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
               <label style={{display:'block', fontSize:'12px', fontWeight:'bold', color:'#757575'}}>HR (bpm)</label>
               <input value={extHr} onChange={e => setExtHr(e.target.value)} style={{ width: '80px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
               <label style={{display:'block', fontSize:'12px', fontWeight:'bold', color:'#757575'}}>RR (/min)</label>
               <input value={extRr} onChange={e => setExtRr(e.target.value)} style={{ width: '80px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffebee', padding: '10px', borderRadius: '6px', border: '2px solid #ffcdd2', marginLeft: 'auto' }}>
               <input type="checkbox" id="overrideCheck" checked={valOverride} onChange={e => setValOverride(e.target.checked)} />
               <label htmlFor="overrideCheck" style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', userSelect: 'none', margin: 0 }}>Emergency Override</label>
            </div>
            <Button onClick={() => {
                socket.emit("update_abg", { caseId: result.caseId, abg: extAbg, spo2: extSpo2, hr: extHr, rr: extRr, override: valOverride, user });
                setExtAbg({ ph: '', pco2: '', po2: '', hco3: '' });
                setExtSpo2('');
                setExtHr('');
                setExtRr('');
                setValOverride(false);
            }} style={{ padding: '10px 24px', backgroundColor: '#1565c0', fontWeight: 'bold' }}>Update Engine</Button>
         </div>
      </Card>

      {/* Time to Action */}
      {result.timeToAction && (
        <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '-12px' }}>
          <span style={{
            fontSize: '18px',
            fontWeight: '700',
            color: result.timeToAction.toLowerCase().includes('immediate') || result.timeToAction.toLowerCase().includes('0-10') ? '#d32f2f' : '#e65100',
            padding: '10px 24px',
            backgroundColor: result.timeToAction.toLowerCase().includes('immediate') || result.timeToAction.toLowerCase().includes('0-10') ? '#ffebee' : '#fff3e0',
            borderRadius: '30px',
            border: `2px solid ${result.timeToAction.toLowerCase().includes('immediate') || result.timeToAction.toLowerCase().includes('0-10') ? '#d32f2f' : '#ff9800'}`,
            display: 'inline-block',
            letterSpacing: '0.5px'
          }}>
            ⏱ {result.timeToAction}
          </span>
        </div>
      )}
      
      {/* Primary Diagnosis & Differentials */}
      <Card title="Clinical Impression">
        <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>PRIMARY DIAGNOSIS</div>
            {result.confidence && (
              <div style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                padding: '4px 8px', 
                borderRadius: '12px', 
                backgroundColor: result.confidence === 'High' ? 'var(--accent-bg)' : 'var(--code-bg)',
                color: result.confidence === 'High' ? 'var(--accent)' : 'var(--text)'
              }}>
                Confidence: {result.confidence}
              </div>
            )}
          </div>
          <div style={{ fontSize: '22px', fontWeight: '600', color: 'var(--text-h)' }}>{result.primaryDiagnosis}</div>
        </div>
        
        {result.differentials && result.differentials.length > 0 && (
          <div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>ALSO CONSIDER:</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {result.differentials.map((diff, idx) => (
                <span key={idx} style={{ 
                  background: 'var(--color-background)', 
                  padding: '6px 12px', 
                  borderRadius: '16px', 
                  fontSize: '14px', 
                  border: '1px solid var(--color-border)' 
                }}>
                  {diff}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Respiratory Status */}
      {result.respiratoryStatus && result.respiratoryStatus.hypoxia && (
        <Card title="RESPIRATORY STATUS">
          <div style={{ padding: '16px', borderRadius: '8px', borderLeft: '6px solid var(--color-danger)', backgroundColor: '#fff3f3', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: '18px', color: 'var(--color-danger)' }}>
              ⚠️ {result.respiratoryStatus.level.toUpperCase()} HYPOXIA DETECTED
            </h3>
            <p style={{ marginTop: '6px', fontWeight: 500, color: 'var(--color-danger)', marginBottom: 0 }}>
              Primary diagnosis protocols are active. Concurrent respiratory failure must be managed immediately.
            </p>
          </div>
        </Card>
      )}

      {/* Predictive Risk Warning */}
      {result.risk && (
        <Card title="PREDICTIVE RISK INDICATORS (EARLY WARNING)">
          <div style={{ backgroundColor: '#fff3e0', padding: '16px', borderRadius: '8px', borderLeft: '6px solid #ff9800', marginBottom: '16px' }}>
            <h3 style={{ color: '#e65100', margin: 0, fontWeight: 700, fontSize: '18px' }}>⚠️ {result.risk} DETECTED</h3>
            <p style={{ marginTop: '6px', fontWeight: 500, color: '#e65100', marginBottom: 0 }}>
              Physiologic trends suggest impending clinical deterioration. Pre-emptive stabilization protocols have been activated.
            </p>
          </div>
        </Card>
      )}

      {/* Escalation Warning */}
      {result.escalation && (
        <Card title="PROTOCOL OVERRIDE / ESCALATION">
          <div style={{ backgroundColor: '#ffcccc', padding: '16px', borderRadius: '8px', borderLeft: '6px solid #d32f2f' }}>
            <h3 style={{ color: '#d32f2f', margin: 0, fontWeight: 700, fontSize: '20px' }}>⚠️ {result.escalation}</h3>
            {result.severity === 'CRITICAL_CONFLICT' && (
              <p style={{ marginTop: '8px', fontWeight: 500, color: '#b71c1c' }}>
                All definitive clinical pathways have been halted due to mutually destructive contraindications. Administering strictly supportive measures only.
              </p>
            )}
          </div>
        </Card>
      )}
      {/* ─── Smart Clinical Suggestion Panel ─────────────────────────────── */}
      {clinicalSuggestion && clinicalSuggestion.topSuggestion && (() => {
         const urgColors = { 
            CRITICAL: { bg: '#ffebee', border: '#e53935', text: '#b71c1c', badge: '#d32f2f', cardBorder: '#c62828' }, 
            HIGH:     { bg: '#fff3e0', border: '#fb8c00', text: '#e65100', badge: '#f57c00', cardBorder: '#ef6c00' }, 
            MODERATE: { bg: '#e3f2fd', border: '#1e88e5', text: '#1565c0', badge: '#1976d2', cardBorder: '#1565c0' }, 
            LOW:      { bg: '#f1f8e9', border: '#66bb6a', text: '#2e7d32', badge: '#388e3c', cardBorder: '#2e7d32' } 
         };
         const top = clinicalSuggestion.topSuggestion;
         const uc = urgColors[top.urgency] || urgColors.LOW;
         
         const renderSecondary = (s, i) => {
            const sc = urgColors[s.urgency] || urgColors.LOW;
            return (
               <div key={i} style={{ padding: '12px 16px', background: '#fff', borderRadius: '8px', borderLeft: `4px solid ${sc.border}`, border: '1px solid #e0e0e0', flex: 1, minWidth: '200px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#333' }}>{s.action}</div>
                  <div style={{ fontSize: '11px', color: '#757575', marginTop: '4px', fontStyle: 'italic' }}>{s.reason}</div>
               </div>
            );
         };

         return (
            <Card title="💡 PROACTIVE CLINICAL GUIDANCE" style={{ marginBottom: '32px', borderLeft: `8px solid ${uc.cardBorder}`, background: uc.bg }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 900, color: uc.text, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                     Patient-Specific Next Best Action
                  </div>
                  <span style={{ background: uc.badge, color: '#fff', padding: '4px 12px', borderRadius: '24px', fontSize: '11px', fontWeight: 900 }}>{top.urgency}</span>
               </div>

               {/* Top Suggestion (Large) */}
               <div style={{ padding: '20px', background: '#fff', borderRadius: '12px', border: `2px solid ${uc.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: uc.text, lineHeight: 1.3 }}>{top.action}</div>
                  <div style={{ fontSize: '13px', color: '#455a64', marginTop: '10px', fontWeight: 500, lineHeight: 1.5, background: uc.bg + '80', padding: '10px', borderRadius: '8px' }}>
                     <strong>Reasoning:</strong> {top.reason}
                  </div>
                  <div style={{ fontSize: '9px', color: '#90a4ae', marginTop: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Decision Tool Source: {top.source}</div>
               </div>

               {/* Secondary Suggestions */}
               {clinicalSuggestion.secondarySuggestions?.length > 0 && (
                  <div>
                     <div style={{ fontSize: '10px', fontWeight: 800, color: '#78909c', textTransform: 'uppercase', marginBottom: '10px' }}>Alternative Options</div>
                     <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {clinicalSuggestion.secondarySuggestions.map(renderSecondary)}
                     </div>
                  </div>
               )}
            </Card>
         );
      })()}
      <style>{`
        @keyframes flash-red-border {
          0% { box-shadow: 0 0 0 0px rgba(211, 47, 47, 0.8); }
          50% { box-shadow: 0 0 0 15px rgba(211, 47, 47, 0); }
          100% { box-shadow: 0 0 0 0px rgba(211, 47, 47, 0); }
        }
        .flash-immediate {
          animation: flash-red-border 1.5s ease-out 1;
        }
      `}</style>

      {result.ventilatorStatus?.predictiveIntel?.actionPriority && (() => {
         const ap = result.ventilatorStatus.predictiveIntel.actionPriority;
         const isImmediate = ap.priorityLevel === 'IMMEDIATE';
         const isUrgent    = ap.priorityLevel === 'URGENT';

         const badgeColor = isImmediate ? '#d32f2f' : isUrgent ? '#ff9800' : '#4caf50';
         const badgeText  = isImmediate ? 'RED' : isUrgent ? 'ORANGE' : 'GREEN';
         const panelColor = isImmediate ? '#b71c1c' : isUrgent ? '#e65100' : '#2e7d32';
         const panelBg    = isImmediate ? '#ffebee' : isUrgent ? '#fff3e0' : '#e8f5e9';

         return (
            <Card className={isImmediate ? 'flash-immediate' : ''} title="🚨 PRIORITY BEDSIDE ACTIONS" style={{ marginBottom: '32px', borderTop: `8px solid ${badgeColor}` }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                     <div style={{ fontSize: '12px', color: '#757575', fontWeight: 800, textTransform: 'uppercase' }}>Priority Level</div>
                     <span style={{
                        display: 'inline-block',
                        padding: '6px 16px',
                        borderRadius: '24px',
                        backgroundColor: badgeColor,
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: '18px',
                        marginTop: '4px'
                     }}>
                        {badgeText}
                     </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                     <div style={{ fontSize: '12px', color: '#757575', fontWeight: 800, textTransform: 'uppercase' }}>Act Within</div>
                     <div style={{ fontSize: '20px', fontWeight: 900, color: panelColor, marginTop: '4px' }}>⏱ {ap.timeToAct}</div>
                  </div>
               </div>

               <div style={{ backgroundColor: panelBg, padding: '16px', borderRadius: '8px', marginBottom: '20px', borderLeft: `6px solid ${panelColor}` }}>
                  <div style={{ fontSize: '11px', color: '#757575', fontWeight: 800, marginBottom: '4px' }}>FAILURE PATTERN</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: panelColor }}>{ap.probableFailureType.toUpperCase()}</div>
               </div>

               <div>
                  <div style={{ fontSize: '12px', color: '#757575', fontWeight: 800, marginBottom: '12px', textTransform: 'uppercase' }}>Top 3 Recommended Actions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                     {ap.recommendedActions.slice(0, 3).map((action, idx) => (
                        <div key={idx} style={{
                           padding: '14px 18px',
                           backgroundColor: '#fff',
                           borderRadius: '8px',
                           border: '1px solid #e0e0e0',
                           fontSize: '15px',
                           fontWeight: 700,
                           color: '#333',
                           display: 'flex',
                           alignItems: 'center',
                           gap: '10px',
                           boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                        }}>
                           <span style={{ minWidth: '24px', height: '24px', borderRadius: '50%', backgroundColor: panelBg, color: panelColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>{idx + 1}</span>
                           {action}
                        </div>
                     ))}
                  </div>
               </div>

               <div style={{ marginTop: '16px', fontSize: '11px', color: '#9e9e9e', fontStyle: 'italic', textAlign: 'center' }}>
                  Safety: Physiologic pattern suggestions only. Verify clinical status STAT.
               </div>
            </Card>
         );
      })()}

      {/* ─── Clinical Pathway Panel ───────────────────────────────────────── */}
      {result.ventilatorStatus?.predictiveIntel?.clinicalPathway && (() => {
         const cp = result.ventilatorStatus.predictiveIntel.clinicalPathway;
         const isGeneral = cp.pathwayKey === 'GENERAL';
         const headerBg  = isGeneral ? '#f5f5f5' : '#1a237e';
         const headerTxt = isGeneral ? '#424242' : '#fff';

         const catConfig = {
            IMMEDIATE:           { color: '#d32f2f', bg: '#ffebee',  label: 'IMMEDIATE' },
            URGENT:              { color: '#e65100', bg: '#fff3e0',  label: 'URGENT' },
            SUPPORTIVE:          { color: '#1565c0', bg: '#e3f2fd',  label: 'SUPPORTIVE' },
            STEP_1_MILD:         { color: '#2e7d32', bg: '#e8f5e9',  label: 'STEP 1 — MILD' },
            STEP_2_MODERATE:     { color: '#f57c00', bg: '#fff3e0',  label: 'STEP 2 — MODERATE' },
            STEP_3_SEVERE:       { color: '#d32f2f', bg: '#ffebee',  label: 'STEP 3 — SEVERE' },
            STEP_4_NIV:          { color: '#b71c1c', bg: '#ffcdd2',  label: 'STEP 4 — NIV' },
            STEP_5_INTUBATION:   { color: '#7b1fa2', bg: '#f3e5f5',  label: 'STEP 5 — INTUBATE' },
            CAUSE_SPECIFIC:      { color: '#0277bd', bg: '#e1f5fe',  label: 'CAUSE-SPECIFIC' },
            VENTILATOR_SETTINGS: { color: '#00695c', bg: '#e0f2f1',  label: 'VENT SETTINGS' },
            ADVANCED:            { color: '#4a148c', bg: '#ede7f6',  label: 'ADVANCED' },
            MONITORING:          { color: '#37474f', bg: '#eceff1',  label: 'MONITORING' },
            WEANING:             { color: '#558b2f', bg: '#f1f8e9',  label: 'WEANING' },
            CARDIOGENIC:         { color: '#ad1457', bg: '#fce4ec',  label: 'CARDIOGENIC' },
            OBSTRUCTIVE:         { color: '#6a1b9a', bg: '#f3e5f5',  label: 'OBSTRUCTIVE' },
            RESOLUTION:          { color: '#2e7d32', bg: '#e8f5e9',  label: 'RESOLUTION' },
         };

         return (
            <Card style={{ marginBottom: '32px', overflow: 'hidden', border: isGeneral ? '1px solid #e0e0e0' : 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
               {/* Header */}
               <div style={{ background: headerBg, padding: '20px 24px', borderRadius: '8px 8px 0 0', marginLeft: '-16px', marginRight: '-16px', marginTop: '-16px' }}>
                  <div style={{ fontSize: '10px', color: isGeneral ? '#9e9e9e' : 'rgba(255,255,255,0.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>📋 Clinical Pathway Engine</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: headerTxt }}>{cp.pathwayName}</div>
                  <div style={{ fontSize: '11px', color: isGeneral ? '#9e9e9e' : 'rgba(255,255,255,0.55)', marginTop: '6px', fontStyle: 'italic' }}>Evidence Source: {cp.evidence}</div>
               </div>

               {/* ─── SLA Breach Alert Banners ─── */}
               {slaAlerts.length > 0 && (
                  <div style={{ marginLeft: '-16px', marginRight: '-16px' }}>
                     {slaAlerts.map((alert, i) => (
                        <div key={alert.id || i} style={{ 
                           padding: '10px 20px', 
                           background: '#b71c1c', 
                           color: '#fff', 
                           fontSize: '13px', 
                           fontWeight: 700,
                           display: 'flex',
                           alignItems: 'center',
                           gap: '8px',
                           borderBottom: '1px solid rgba(255,255,255,0.15)'
                        }}>
                           🚨 SLA BREACH — {alert.message}
                           <button onClick={() => setSlaAlerts(p => p.filter((_, idx) => idx !== i))} 
                              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
                        </div>
                     ))}
                  </div>
               )}

               {/* ─── Execution Compliance Panel ─── */}
               {executionCompliance && (() => {
                  const ec = executionCompliance;
                  const scoreColor = ec.complianceScore > 90 ? '#2e7d32' : ec.complianceScore >= 70 ? '#f57f17' : '#c62828';
                  const scoreBg    = ec.complianceScore > 90 ? '#e8f5e9' : ec.complianceScore >= 70 ? '#fffde7' : '#ffebee';
                  const scoreBorder= ec.complianceScore > 90 ? '#a5d6a7' : ec.complianceScore >= 70 ? '#ffe082' : '#ef9a9a';
                  const progressColor = ec.completionRate === 100 ? '#2e7d32' : ec.completionRate >= 60 ? '#f57f17' : '#c62828';

                  const fmtTime = (ts) => {
                     if (!ts) return '—';
                     const d = new Date(ts);
                     return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                  };
                  const fmtDuration = (ms) => {
                     if (!ms) return '—';
                     const s = Math.round(ms / 1000);
                     if (s < 60) return `${s}s`;
                     return `${Math.floor(s / 60)}m ${s % 60}s`;
                  };

                  const statusIcon = { COMPLETED: '✅', DELAYED: '⚠️', MISSED: '🚨', PENDING: '⌛' };
                  const statusColor = { COMPLETED: '#2e7d32', DELAYED: '#e65100', MISSED: '#b71c1c', PENDING: '#546e7a' };
                  const statusBg    = { COMPLETED: '#f1f8e9', DELAYED: '#fff3e0', MISSED: '#ffebee', PENDING: '#f5f5f5' };

                  return (
                     <div style={{ marginLeft: '-16px', marginRight: '-16px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                        {/* ── Score Header Row ── */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', background: scoreBg, borderBottom: `2px solid ${scoreBorder}` }}>
                           {/* Compliance Score Circle */}
                           <div style={{ flex: '0 0 80px', height: '80px', borderRadius: '50%', background: '#fff', border: `4px solid ${scoreColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 4px ${scoreBg}` }}>
                              <div style={{ fontSize: '20px', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{ec.complianceScore}</div>
                              <div style={{ fontSize: '8px', fontWeight: 700, color: scoreColor, textTransform: 'uppercase' }}>/ 100</div>
                           </div>

                           <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '11px', fontWeight: 900, color: scoreColor, textTransform: 'uppercase', marginBottom: '6px' }}>
                                 {ec.complianceScore > 90 ? '🟢 Excellent Compliance' : ec.complianceScore >= 70 ? '🟡 Compliance Warning' : '🔴 Critical Compliance Breach'}
                              </div>
                              {/* Completion Progress Bar */}
                              <div style={{ fontSize: '10px', color: '#757575', fontWeight: 700, marginBottom: '4px' }}>
                                 Completion: {ec.completionRate}% ({ec.completedCount}/{ec.totalSteps} steps)
                              </div>
                              <div style={{ height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                                 <div style={{ height: '100%', width: `${ec.completionRate}%`, background: progressColor, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                              </div>
                              {/* Chips Row */}
                              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                                 {ec.delayedSteps?.length > 0 && (
                                    <span style={{ padding: '3px 8px', background: '#fff3e0', borderRadius: '12px', fontSize: '10px', fontWeight: 800, color: '#e65100', border: '1px solid #ffcc02' }}>
                                       ⚠️ {ec.delayedSteps.length} Delayed
                                    </span>
                                 )}
                                 {ec.missedSteps?.length > 0 && (
                                    <span style={{ padding: '3px 8px', background: '#ffebee', borderRadius: '12px', fontSize: '10px', fontWeight: 800, color: '#c62828', border: '1px solid #ef9a9a' }}>
                                       🚨 {ec.missedSteps.length} Missed
                                    </span>
                                 )}
                                 {ec.delayedSteps?.length === 0 && ec.missedSteps?.length === 0 && (
                                    <span style={{ padding: '3px 8px', background: '#e8f5e9', borderRadius: '12px', fontSize: '10px', fontWeight: 800, color: '#2e7d32', border: '1px solid #a5d6a7' }}>
                                       ✅ No SLA Breaches
                                    </span>
                                 )}
                              </div>
                           </div>
                        </div>

                        {/* ── Step Timeline ── */}
                        {ec.stepTimeline?.length > 0 && (
                           <div style={{ padding: '12px 20px', background: '#fafafa' }}>
                              <div style={{ fontSize: '10px', fontWeight: 900, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                                 ⏱ Clinical Execution Timeline
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                 {ec.stepTimeline.map((step, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: statusBg[step.status] || '#f5f5f5', borderRadius: '6px', borderLeft: `3px solid ${statusColor[step.status] || '#9e9e9e'}` }}>
                                       <span style={{ fontSize: '14px', flexShrink: 0 }}>{statusIcon[step.status] || '○'}</span>
                                       <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.label}</div>
                                          <div style={{ fontSize: '10px', color: '#757575', marginTop: '1px' }}>
                                             Assigned: {fmtTime(step.assignedAt)}
                                             {step.completedAt && ` → Done: ${fmtTime(step.completedAt)}`}
                                             {step.timeTakenMs && ` (${fmtDuration(step.timeTakenMs)})`}
                                             {step.delayMs && <span style={{ color: '#e65100', fontWeight: 700 }}> +{fmtDuration(step.delayMs)} over SLA</span>}
                                             {step.completedBy && <span style={{ color: '#9e9e9e' }}> • {step.completedBy}</span>}
                                          </div>
                                       </div>
                                       <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '9px', fontWeight: 800, background: statusColor[step.status] || '#9e9e9e', color: '#fff', flexShrink: 0 }}>
                                          {step.slaCategory}
                                       </span>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>
                  );
               })()}

               {/* ─── Clinical Notes System ─── */}
               <div style={{ padding: '0 16px 16px 16px', marginTop: '24px' }}>
                  <ClinicalNotes caseId={result?.caseId} user={user} socket={socket} />
               </div>


               <div style={{ paddingTop: '20px' }}>
                  {/* Time Targets */}
                  {cp.timeTargets?.length > 0 && (
                     <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '11px', color: '#757575', fontWeight: 800, marginBottom: '10px', textTransform: 'uppercase' }}>⏱ Mandatory Time Targets</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                           {cp.timeTargets.map((t, i) => {
                              const c = t.priority === 'CRITICAL' ? '#d32f2f' : t.priority === 'HIGH' ? '#e65100' : '#1565c0';
                              const b = t.priority === 'CRITICAL' ? '#ffebee' : t.priority === 'HIGH' ? '#fff3e0' : '#e3f2fd';
                              return (
                                 <div key={i} style={{ padding: '12px', background: b, borderRadius: '8px', borderLeft: `4px solid ${c}` }}>
                                    <div style={{ fontSize: '10px', color: c, fontWeight: 700, textTransform: 'uppercase' }}>{t.priority}</div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#333', marginTop: '2px' }}>{t.label}</div>
                                    <div style={{ fontSize: '16px', fontWeight: 900, color: c, marginTop: '4px' }}>{t.target}</div>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  )}

                  {/* Checklist */}
                  {cp.checklist?.length > 0 && (
                     <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '11px', color: '#757575', fontWeight: 800, marginBottom: '10px', textTransform: 'uppercase' }}>✅ Step-by-Step Clinical Checklist</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                           {cp.checklist.map((item, i) => {
                              const cfg = catConfig[item.category] || { color: '#424242', bg: '#f5f5f5', label: item.category };
                              const isChecked = !!checkedPathwaySteps[i];
                              return (
                                 <div key={i} onClick={() => {
                                    const newState = !checkedPathwaySteps[i];
                                    setCheckedPathwaySteps(prev => ({ ...prev, [i]: newState }));
                                    if (newState) {
                                       socket.emit('pathway_step_complete', { 
                                          caseId: result.caseId, 
                                          stepIndex: i, 
                                          stepData: item 
                                       });
                                    }
                                 }} style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '12px', 
                                    padding: '12px 16px', 
                                    background: isChecked ? '#f1f8e9' : '#fff', 
                                    borderRadius: '8px', 
                                    border: isChecked ? '1px solid #c8e6c9' : '1px solid #f0f0f0', 
                                    borderLeft: `5px solid ${isChecked ? '#4caf50' : cfg.color}`, 
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    opacity: isChecked ? 0.8 : 1
                                 }}>
                                    <input type="checkbox" checked={isChecked} readOnly style={{ width: '20px', height: '20px', cursor: 'pointer', marginRight: '4px' }} />
                                    <div style={{ flex: 1 }}>
                                       <div style={{ fontSize: '10px', color: isChecked ? '#4caf50' : cfg.color, fontWeight: 800, marginBottom: '2px', textTransform: 'uppercase' }}>{cfg.label} {isChecked && '— DONE'}</div>
                                       <div style={{ fontSize: '14px', fontWeight: 600, color: isChecked ? '#757575' : '#333', lineHeight: 1.4, textDecoration: isChecked ? 'line-through' : 'none' }}>{item.task}</div>
                                    </div>
                                    <span style={{ minWidth: '22px', height: '22px', borderRadius: '50%', background: isChecked ? '#c8e6c9' : cfg.bg, color: isChecked ? '#4caf50' : cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900, flexShrink: 0 }}>{item.step}</span>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  )}

                  {/* Safety Warnings */}
                  {cp.warnings?.length > 0 && (
                     <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', color: '#757575', fontWeight: 800, marginBottom: '10px', textTransform: 'uppercase' }}>⚠️ Protocol Safeguards</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                           {cp.warnings.map((w, i) => (
                              <div key={i} style={{ padding: '10px 14px', background: w.startsWith('⛔') ? '#ffebee' : '#fff8e1', borderLeft: `4px solid ${w.startsWith('⛔') ? '#d32f2f' : '#f57f17'}`, borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: w.startsWith('⛔') ? '#b71c1c' : '#e65100' }}>
                                 {w}
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  <div style={{ padding: '10px 14px', background: '#f9f9f9', borderRadius: '6px', border: '1px solid #e0e0e0', fontSize: '11px', color: '#9e9e9e', fontStyle: 'italic', textAlign: 'center' }}>
                     🛡️ {cp.safetyNote}
                  </div>
               </div>
            </Card>
         );
      })()}

      {/* Immediate Plan (Most Important) */}
      {result.immediatePlan && result.immediatePlan.length > 0 && (
        <Card title="Immediate First 10 Minutes">
          {role === 'doctor' && !overrideTriggered && (
             <Button onClick={handleOverride} variant="secondary" style={{ backgroundColor: '#fff', color: '#d32f2f', border: '1px solid #d32f2f', marginBottom: '16px', width: '100%' }}>⚠️ Manual Physician Override</Button>
          )}
          {overrideTriggered && (
             <div style={{ backgroundColor: '#ffebee', padding: '12px', color: '#d32f2f', fontWeight: 'bold', borderLeft: '4px solid #d32f2f', marginBottom: '16px' }}>
               🚫 SYSTEM SUGGESTIONS BYPASSED BY PHYSICIAN
             </div>
          )}
          {result.immediatePlan.map((step, idx) => (
            <div key={idx} className="immediate-plan-item">
              🔴 {step}
            </div>
          ))}
        </Card>
      )}



      {result.treatments && result.treatments.length > 0 && (
        <Card title="CDSS Priority Treatments">
          {result.treatments.map((t, idx) => (
            <div key={idx} className="action-item" style={{ borderLeft: `6px solid ${t.priority === 1 ? 'var(--color-danger)' : 'var(--color-warning)'}` }}>
              <div className="action-step">PRIORITY {t.priority}</div>
              <div className="action-content">
                <div className="action-title">{t.drug} {t.dose} ({t.route})</div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  Reason: {t.reason}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Shock Classification */}
      {result.shockType && (
        <Card title="HEMODYNAMIC SHOCK CLASSIFICATION">
           <p style={{ color: "var(--color-danger)", fontWeight: "bold", fontSize: "18px", margin: "8px 0" }}>⚠️ {result.shockType}</p>
        </Card>
      )}

      {/* Ventilation Settings */}
      {result.ventilation && (
        <Card title="RESPIRATORY / VENTILATION PROTOCOL">
           <div style={{ backgroundColor: "#e3f2fd", padding: "16px", borderRadius: "8px", borderLeft: "6px solid #1976d2" }}>
             <h4 style={{ color: "#1565c0", margin: "0 0 8px 0", fontSize: "16px" }}>{result.ventilation.mode}</h4>
             <ul style={{ color: "#0d47a1", margin: 0, paddingLeft: "20px" }}>
                {Object.entries(result.ventilation.settings).map(([key, val], idx) => (
                   <li key={idx} style={{ marginBottom: "4px" }}><strong>{key.toUpperCase()}:</strong> {val}</li>
                ))}
             </ul>
           </div>
        </Card>
      )}

      {/* Detailed Action Checklist */}
      {result.actionChecklist && result.actionChecklist.length > 0 && (
        <Card title="Detailed Action Checklist">
          {result.actionChecklist.map((item) => (
            <div key={item.step} className="action-item">
              <div className="action-step">{item.step}</div>
              <div className="action-content">
                <div className="action-title">{item.action}</div>
                <div className={`action-urgency urgency-${item.urgency}`}>
                  {item.urgency}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Safety Alerts */}
      {result.safetyAlerts && result.safetyAlerts.length > 0 && (
        <Card title="Critical Safety Warnings">
          {result.safetyAlerts.map((alert, idx) => (
            <div key={idx} className="safety-alert">
              ⚠️ {alert}
            </div>
          ))}
        </Card>
      )}

      {/* Contraindications Triggered */}
      {result.contraindicationsTriggered && result.contraindicationsTriggered.length > 0 && (
        <Card title="Contraindication Safety Blocks">
          <div style={{ padding: '8px', borderLeft: '4px solid var(--color-danger)', backgroundColor: '#fff3f3' }}>
            {result.contraindicationsTriggered.map((alert, idx) => (
              <div key={idx} style={{ color: 'var(--color-danger)', fontSize: '14px', marginBottom: '4px' }}>
                🛑 {alert}
              </div>
            ))}
          </div>
        </Card>
      )}
      
      {/* Medication Alerts */}
      {result.medicationAlerts && result.medicationAlerts.length > 0 && (
        <Card title="Formulary & Allergy Blocks">
          <div style={{ padding: '8px', borderLeft: '4px solid var(--color-danger)', backgroundColor: '#fff3f3' }}>
            {result.medicationAlerts.map((alert, idx) => (
              <div key={idx} style={{ color: 'var(--color-danger)', fontSize: '14px', marginBottom: '4px' }}>
                ⚠️ {alert}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Missing Critical Questions */}
      {result.missingCriticalQuestions && result.missingCriticalQuestions.length > 0 && (
        <Card title="Medico-Legal / Assessment Warnings">
          <div style={{ padding: '12px', borderLeft: '6px solid #b71c1c', backgroundColor: '#ffebee', borderRadius: '4px' }}>
            <h4 style={{color: '#b71c1c', marginTop: 0, marginBottom: '8px'}}>Important history missing — please complete</h4>
            {result.missingCriticalQuestions.map((q, idx) => (
              <div key={idx} style={{ color: '#c62828', fontSize: '14px', marginBottom: '4px', fontWeight: 500 }}>
                ❌ {q}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Transfer Rule Generated Warning */}
      {result.transferNeeded && (
        <Card>
          <div style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: 18 }}>
            🚨 TRANSFER SECURED / LETTER RENDERED IN SYSTEM
          </div>
        </Card>
      )}

      {/* When to Seek Immediate Help (redFlagAdvice) */}
      {result.redFlagAdvice && result.redFlagAdvice.length > 0 && (
        <Card title="When to Seek Immediate Help">
          <div style={{ backgroundColor: '#ffebee', padding: '16px', borderRadius: '8px', borderLeft: '6px solid #b71c1c' }}>
            {result.redFlagAdvice.map((advice, idx) => (
              <div key={idx} style={{ color: '#b71c1c', fontWeight: 600, fontSize: '16px', marginBottom: '8px' }}>
                🚨 {advice}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Advice Section */}
      {(result.lifestyleAdvice?.length > 0 || result.dietAdvice?.length > 0) && (
        <Card title="Patient Advice">
          {result.lifestyleAdvice && result.lifestyleAdvice.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-primary)' }}>Lifestyle Advice</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text)' }}>
                {result.lifestyleAdvice.map((adv, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{adv}</li>
                ))}
              </ul>
            </div>
          )}
          {result.dietAdvice && result.dietAdvice.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-secondary)' }}>Diet Advice</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text)' }}>
                {result.dietAdvice.map((adv, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{adv}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Audit Trail Section */}
      {result.auditTrail && result.auditTrail.length > 0 && (
        <Card title="Clinical Actions (Audit Trail)">
          <div style={{ borderLeft: '3px solid var(--border)', paddingLeft: '16px', marginLeft: '8px' }}>
            {result.auditTrail.map((action, idx) => (
              <div key={idx} style={{ position: 'relative', marginBottom: '12px' }}>
                <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '10px', height: '10px', backgroundColor: 'var(--color-primary)', borderRadius: '50%' }}></div>
                <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{action}</span>
              </div>
            ))}
            {overrideTriggered && (
              <div style={{ position: 'relative', marginBottom: '12px', marginTop: '16px' }}>
                <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '10px', height: '10px', backgroundColor: '#d32f2f', borderRadius: '50%' }}></div>
                <span style={{ fontSize: '14px', color: '#d32f2f', fontWeight: 600 }}>Manual override executed by physician at {overrideTime}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Discharge Summary */}
      {(role === 'doctor' || role === 'admin') && result.dischargeSummary && (
        <Card title="Discharge Summary & Medico-Legal Trace">
          <div style={{ backgroundColor: 'var(--code-bg)', padding: '16px', borderRadius: '6px', fontSize: '14px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', border: '1px solid var(--border)', color: 'var(--text)' }}>
            {result.dischargeSummary}
          </div>
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button onClick={handleCopy} variant="secondary">
              {copied ? "Copied to Clipboard!" : "Copy Summary"}
            </Button>
            <Button onClick={() => window.print()} variant="secondary" style={{ backgroundColor: '#2196f3', color: '#fff', borderColor: '#2196f3' }}>
              Print File
            </Button>
            <Button onClick={() => {
              const text = encodeURIComponent(result.dischargeSummary);
              window.open(`https://wa.me/?text=${text}`, '_blank');
            }} variant="primary" style={{ backgroundColor: '#25D366', color: '#fff', borderColor: '#25D366' }}>
              Share (WhatsApp)
            </Button>
          </div>
        </Card>
      )}

      <div style={{ marginTop: 48, marginBottom: 64 }}>
        <Button size="large" onClick={handleEvaluateNew} variant="secondary">
          Evaluate New Patient
        </Button>
      </div>

      <Card title="ADMINISTRATIVE & REVENUE INTELLIGENCE">
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <Button onClick={() => navigate(`/billing/${result.caseId}`)} variant="primary" style={{ backgroundColor: '#1a237e', color: '#fff', border: 'none' }}>
            🛡️ View Claim & Billing Intelligence Dashboard
          </Button>
        </div>
      </Card>

      {showHandover && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '550px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
             <h3 style={{ marginTop: 0, fontSize: '24px', color: 'var(--color-primary)' }}>Shift Handover Summary</h3>
             <textarea readOnly value={`HANDOVER TRACE [${new Date().toLocaleTimeString()}]\nPatient: ${pName} (${pAge}/${pGender})\nDiagnosis: ${result.primaryDiagnosis}\nSeverity: ${result.severity}\nImmediate Action: ${result.immediatePlan?.join(' | ') || 'None'}\nPending Checklist: ${result.actionChecklist?.map(a => a.action).join(', ') || 'None'}`} style={{ width: '100%', height: '180px', padding: '16px', fontFamily: 'monospace', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '24px', backgroundColor: '#f5f5f5', resize: 'none' }} />
             <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
               <Button onClick={() => setShowHandover(false)} variant="secondary">Close Modal</Button>
               <Button onClick={() => {
                 const text = `HANDOVER TRACE [${new Date().toLocaleTimeString()}]\nPatient: ${displayName} (${pAge}/${pGender})\nDiagnosis: ${result.primaryDiagnosis}\nSeverity: ${result.severity}\nImmediate Action: ${result.immediatePlan?.join(' | ') || 'None'}\nPending Checklist: ${result.actionChecklist?.map(a => a.action).join(', ') || 'None'}`;
                 if (!navigator.clipboard) {
                    setManualCopyText(text);
                    setShowManualCopy(true);
                    return;
                 }
                 navigator.clipboard.writeText(text).then(() => {
                   setCopied(true);
                   setTimeout(() => setCopied(false), 2000);
                   
                   setClipboardTimer(60);
                   const countdown = setInterval(() => {
                     setClipboardTimer((prev) => {
                       if (prev <= 1) {
                         clearInterval(countdown);
                         navigator.clipboard?.writeText(" ");
                         return null;
                       }
                       return prev - 1;
                     });
                   }, 1000);
                 }).catch(() => {
                    setManualCopyText(text);
                    setShowManualCopy(true);
                 });
               }}>Copy Handover Content</Button>
             </div>
          </div>
        </div>
      )}

      {showManualCopy && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '550px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
             <h3 style={{ marginTop: 0, fontSize: '20px', color: '#d32f2f', display: 'flex', alignItems: 'center', gap: '8px' }}>⚠️ Clipboard access blocked</h3>
             <p style={{ fontSize: '15px', marginBottom: '16px', color: '#424242', fontWeight: 500 }}>Please copy this text manually:</p>
             <textarea readOnly value={manualCopyText} style={{ width: '100%', height: '250px', padding: '16px', fontFamily: 'monospace', fontSize: '13px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '24px', backgroundColor: '#fafafa', resize: 'none' }} />
             <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={() => setShowManualCopy(false)} variant="primary">Close</Button>
             </div>
          </div>
        </div>
      )}

      {showDischargeModal && dischargeData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '20px' }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', position: 'relative' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '16px' }}>
                <h2 style={{ margin: 0, color: '#1b5e20' }}>📄 Official Discharge Summary (Medico-Legal)</h2>
                <button onClick={() => setShowDischargeModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}>&times;</button>
             </div>
             
             <pre style={{ 
               backgroundColor: '#f8f9fa', 
               padding: '24px', 
               borderRadius: '8px', 
               fontSize: '13px', 
               lineHeight: '1.5', 
               fontFamily: '"JetBrains Mono", "Cascadia Code", monospace', 
               whiteSpace: 'pre-wrap', 
               border: '1px solid #dee2e6',
               color: '#212529'
             }}>
               {dischargeData.summaryText}
             </pre>

             <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', position: 'sticky', bottom: 0, backgroundColor: '#fff', paddingTop: '16px', borderTop: '1px solid #eee' }}>
                <Button onClick={() => {
                   if (!navigator.clipboard) {
                      setManualCopyText(dischargeData.summaryText);
                      setShowManualCopy(true);
                      return;
                   }
                   navigator.clipboard.writeText(dischargeData.summaryText);
                   setCopied(true);
                   setTimeout(() => setCopied(false), 2000);
                }} variant="secondary">Copy Technical Print-Out</Button>
                <Button onClick={() => {
                   const win = window.open('', '_blank');
                   win.document.write(`<html><head><title>Discharge Summary</title></head><body style="padding:40px; font-family:monospace; white-space:pre-wrap;">${dischargeData.summaryText}</body></html>`);
                   win.document.close();
                   win.print();
                }} variant="primary" style={{ backgroundColor: '#1b5e20', border: 'none' }}>Print Report</Button>
                <Button onClick={() => setShowDischargeModal(false)} variant="secondary">Close</Button>
             </div>
          </div>
        </div>
      )}

      {showInsuranceModal && insuranceData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '20px' }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '900px', maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', position: 'relative' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #fb8c00', paddingBottom: '16px' }}>
                <h2 style={{ margin: 0, color: '#e65100' }}>💰 Insurance Justification (Claim-Approval Grade)</h2>
                <button onClick={() => setShowInsuranceModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}>&times;</button>
             </div>
             
             <div style={{ backgroundColor: '#fff8e1', padding: '16px', borderRadius: '8px', borderLeft: '6px solid #fb8c00', marginBottom: '20px', fontSize: '14px', color: '#5d4037' }}>
                <strong>⚠️ Defense Document Notice:</strong> This report is generated using strict numeric triggers (pH, PaCO2, SpO2, SBP) and is optimized for claim approval. It is immutable and locked once generated.
             </div>

             <pre style={{ 
               backgroundColor: '#263238', 
               padding: '24px', 
               borderRadius: '8px', 
               fontSize: '13px', 
               lineHeight: '1.6', 
               fontFamily: '"Cascadia Code", "Fira Code", monospace', 
               whiteSpace: 'pre-wrap', 
               border: '1px solid #37474f',
               color: '#eceff1',
               boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
             }}>
               {insuranceData.justificationText}
             </pre>

             <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', position: 'sticky', bottom: 0, backgroundColor: '#fff', paddingTop: '16px', borderTop: '1px solid #eee' }}>
                <Button onClick={() => {
                   if (!navigator.clipboard) {
                      setManualCopyText(insuranceData.justificationText);
                      setShowManualCopy(true);
                      return;
                   }
                   navigator.clipboard.writeText(insuranceData.justificationText);
                   setCopied(true);
                   setTimeout(() => setCopied(false), 2000);
                }} variant="secondary">Copy Defense Text</Button>
                <Button onClick={() => {
                   const win = window.open('', '_blank');
                   win.document.write(`<html><head><title>Insurance Justification</title></head><body style="padding:40px; font-family:monospace; white-space:pre-wrap; background:#fff; color:#000;">${insuranceData.justificationText}</body></html>`);
                   win.document.close();
                   win.print();
                }} variant="primary" style={{ backgroundColor: '#e65100', border: 'none' }}>Print Official Justification</Button>
                <Button onClick={() => setShowInsuranceModal(false)} variant="secondary">Close</Button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
