import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DataEntryScreen from './pages/DataEntryScreen';
import ResultsScreen from './pages/ResultsScreen';
import CommandDashboard from './pages/CommandDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { io } from 'socket.io-client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import VerifyPage from './pages/VerifyPage';
import BillingDashboard from './pages/BillingDashboard';

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:5000` : "http://localhost:5000");

const socket = io(API_BASE, {
    autoConnect: false
});

function App() {
  const [result, setResult] = useState(null);
  const [criticalAlert, setCriticalAlert] = useState(null);
  const [clinicalPriorityAlert, setClinicalPriorityAlert] = useState(null);
  const [suppressedBadge, setSuppressedBadge] = useState(null);
  const [patientSnapshot, setPatientSnapshot] = useState([]);
  const [priorityPatients, setPriorityPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [triageList, setTriageList] = useState([]);
  const [resourceStatus, setResourceStatus] = useState({ icuQueue: [], ventilatorQueue: [], overloadWarnings: [] });
  const [noteAlert, setNoteAlert] = useState(null);
  const [loginName, setLoginName] = useState('');
  const [loginRole, setLoginRole] = useState('doctor');
  const [user, setUser] = useState(() => {
      try { return JSON.parse(localStorage.getItem('userContext')); } catch { return null; }
  });
  const [agreed, setAgreed] = useState(() => {
    try {
      return localStorage.getItem('legalDisclaimer') === 'true';
    } catch {
      return false;
    }
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [silentMode, setSilentMode] = useState(localStorage.getItem('silentMode') === 'true');
  const [notifPerm, setNotifPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  
  const triggerBrowserAlert = (data) => {
    if (typeof Notification === 'undefined' || Notification.permission !== "granted") return;

    const n = new Notification("🚨 Critical Patient Alert", {
      body: `${data.patientName || data.caseId} - ${data.alertType || data.task}`,
      requireInteraction: true,
      icon: '/vite.svg'
    });

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }

    n.onclick = () => {
      window.focus();
      if (data.fullData) setResult(data.fullData);
      n.close();
    };
  };
  
  const [caseSnapshots, setCaseSnapshots] = useState(() => {
    const saved = localStorage.getItem('caseSnapshots');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (user?.role) {
      socket.emit("join_role", user.role.toUpperCase());
    }
  }, [user?.role]);

  useEffect(() => {
    if (!user) return;
    socket.emit('join_user', user);

    const handleAlert = (payload) => {
       if (result && result.caseId === payload.caseId) return;
       setCriticalAlert(payload);
       triggerBrowserAlert(payload);
       
       if (localStorage.getItem('silentMode') !== 'true') {
          try {
             const beep = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU");
             beep.play().catch(e => {});
          } catch(e) {}
       }
    };
    
    const handleDelayWarning = (payload) => {
       if (payload.status === 'Severe' || payload.status === 'Overdue') {
          triggerBrowserAlert(payload);
       }
    };
    
    const handleAck = (updatedAlert) => {
       setCriticalAlert(prev => {
          if (prev && prev.caseId === updatedAlert.caseId) {
             return updatedAlert;
          }
          return prev;
       });
    };
    
    const handleActionLogged = ({ caseId, actionLog }) => {
       setCriticalAlert(prev => {
          if (prev && prev.caseId === caseId) {
             return { ...prev, actions: [...(prev.actions || []), actionLog] };
          }
          return prev;
       });
       // Inject dynamically into active screen
       setResult(prev => {
          if (prev && prev.caseId === caseId) {
             const newAuditEntry = `[TELEMETRY] ${actionLog.action} performed by ${actionLog.performedBy} at ${actionLog.timestamp}`;
             const newSummary = (prev.dischargeSummary || '') + `\n-> ${actionLog.timestamp}: ${actionLog.action} (${actionLog.performedBy})`;
             return { ...prev, auditTrail: [...(prev.auditTrail || []), newAuditEntry], dischargeSummary: newSummary };
          }
          return prev;
       });
    };

    const handleCriticalNote = (data) => {
       setNoteAlert(data);
       if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
       // Auto-dismiss after 12 seconds
       setTimeout(() => setNoteAlert(null), 12000);
    };

    socket.on('critical_alert', handleAlert);
    socket.on('delay_warning', handleDelayWarning);
    socket.on('alert_acknowledged', handleAck);
    socket.on('action_logged', handleActionLogged);
    socket.on('critical_note_alert', handleCriticalNote);
    socket.on('patient_snapshot', (data) => setPatientSnapshot(data));
    socket.on('priority_patients', (data) => setPriorityPatients(data));
    
    return () => {
       socket.off('critical_alert', handleAlert);
       socket.off('delay_warning', handleDelayWarning);
       socket.off('alert_acknowledged', handleAck);
       socket.off('action_logged', handleActionLogged);
       socket.off('critical_note_alert', handleCriticalNote);
       socket.off('patient_snapshot');
       socket.off('priority_patients');
       socket.off('triage_update');
       socket.off('resource_update');
    };
  }, [result]);

  useEffect(() => {
    socket.on('triage_update', (data) => setTriageList(data));
    socket.on('resource_update', (data) => setResourceStatus(data));
    return () => {
       socket.off('triage_update');
       socket.off('resource_update');
    };
  }, []);

  useEffect(() => {
    socket.on('patient_tasks_updated', ({ caseId, patient }) => {
       setResult(prev => {
          if (prev && prev.caseId === caseId) {
             return {
                ...prev,
                assignedTo: patient.assignedTo,
                assignedBy: patient.assignedBy,
                tasks: patient.tasks,
                ventilatorStatus: patient.fullData?.ventilatorStatus,
                vitalHistory: patient.fullData?.vitalHistory || prev.vitalHistory
             };
          }
          return prev;
       });
    });

    socket.on('suppressed_alert', ({ alertType }) => {
       setSuppressedBadge(`Spam Suppressed: ${alertType}`);
       setTimeout(() => setSuppressedBadge(null), 3000);
    });
    
    return () => {
       socket.off('patient_tasks_updated');
       socket.off('suppressed_alert');
    }
  }, [result]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("sessionToken");
    const savedUser = localStorage.getItem("userContext");
    if (savedToken && savedUser) {
      setUser(JSON.parse(savedUser));
      socket.auth = { token: savedToken };
      socket.connect();
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userContext");
    localStorage.removeItem("sessionToken");
    setUser(null);
    socket.disconnect();
  };

  useEffect(() => {
    socket.on("connect_error", (err) => {
        if (err.message === "Authentication error") {
            alert("Session expired or invalid. Please login again.");
            handleLogout();
        }
    });
    return () => {
      socket.off("connect_error");
    };
  }, []);

  useEffect(() => {
    const savedStats = localStorage.getItem('caseSnapshots');
    if (savedStats) {
      try {
        const parsed = JSON.parse(savedStats);
        const valid = parsed.filter(p => {
           if (!p.fullData || !p.fullData.localTimestamp) return true;
           return (Date.now() - p.fullData.localTimestamp) < (24 * 60 * 60 * 1000);
        });
        if (valid.length !== parsed.length) {
          localStorage.setItem('caseSnapshots', JSON.stringify(valid));
          setCaseSnapshots(valid);
        }
      } catch(e){}
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginName.trim()) {
      alert("Please enter your name for accountability.");
      return;
    }
    try {
        const { data } = await axios.post(`${API_BASE}/api/auth/login`, { name: loginName, role: loginRole });
        localStorage.setItem("sessionToken", data.token);
        localStorage.setItem("userContext", JSON.stringify(data.user));
        setUser(data.user);
        socket.auth = { token: data.token };
        socket.connect();
    } catch (err) {
        alert("Authentication Failed. Network error.");
    }
  };

  const handleAnalyze = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API_BASE}/api/clinical`, payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("sessionToken")}`
        }
      });
      data.localTimestamp = Date.now();
      setResult(data);
      
      if (!data.error && data.caseId) {
        const newSnapshot = {
          name: data.patientInfo?.name || 'Unknown',
          caseId: data.caseId,
          diagnosis: data.primaryDiagnosis,
          timestamp: new Date().toLocaleTimeString(),
          severity: data.severity,
          fullData: data
        };
        setCaseSnapshots(prev => {
          const filtered = prev.filter(p => p.caseId !== newSnapshot.caseId);
          const updated = [newSnapshot, ...filtered].slice(0, 10);
          localStorage.setItem('caseSnapshots', JSON.stringify(updated));
          return updated;
        });
      }

    } catch (err) {
      const fallbackResult = {
        status: "SAFE_MODE",
        message: "Offline Mode — use basic emergency care.",
        fallbackPlan: [
          "Stabilize airway, breathing, circulation",
          "Call senior consultant immediately"
        ]
      };
      setResult(fallbackResult);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  if (!agreed) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '12px', maxWidth: '540px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <h2 style={{ color: '#d32f2f', marginBottom: '24px', fontWeight: 800, letterSpacing: '-0.5px' }}>⚠️ MEDICO-LEGAL DISCLAIMER</h2>
            <p style={{ fontSize: '18px', fontWeight: 500, lineHeight: 1.6, marginBottom: '32px', color: '#424242' }}>
              This system assists clinical decisions. Final responsibility lies entirely with the treating physician. 
            </p>
            <button onClick={() => { 
                setAgreed(true); 
                try { localStorage.setItem('legalDisclaimer', 'true'); } catch(e) {} 
              }} style={{ padding: '16px 32px', backgroundColor: '#0d47a1', color: '#fff', fontSize: '18px', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', width: '100%', transition: 'all 0.2s' }}>
              I Agree & Continue
            </button>
         </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: '"Inter", sans-serif' }}>
         <h1 style={{ color: 'var(--color-primary)', fontSize: '32px', marginBottom: '8px' }}>Clinical OS Login</h1>
         <p style={{ color: 'var(--color-text-secondary)', marginBottom: '40px' }}>Secure Medico-Legal Access Portal</p>
         <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '340px', margin: '0 auto' }}>
           <input name="uname" placeholder="Enter Full Name (e.g. Dr. Sarah)" style={{ padding: '16px', fontSize: '18px', border: '1px solid #ccc', borderRadius: '8px' }} required value={loginName} onChange={(e) => setLoginName(e.target.value)} />
           <select name="urole" style={{ padding: '16px', fontSize: '18px', border: '1px solid #ccc', borderRadius: '8px' }} value={loginRole} onChange={(e) => setLoginRole(e.target.value)}>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="consultant">Consultant</option>
              <option value="admin">Admin</option>
           </select>
           <button type="submit" style={{ padding: '16px', fontSize: '18px', backgroundColor: '#0d47a1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Authenticate Identity</button>
         </form>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/billing/:caseId" element={<BillingDashboard />} />
        <Route path="/" element={
           <>
            {/* Sidebar for Recent Patients */}
            {user && (
              <div style={{ position: 'fixed', left: 0, top: 0, width: '260px', backgroundColor: '#fff', borderRight: '1px solid var(--border)', padding: '16px', height: '100vh', overflowY: 'auto', boxShadow: '2px 0 12px rgba(0,0,0,0.08)', zIndex: 1000 }}>
                <h3 style={{ fontSize: '18px', color: 'var(--color-primary)', borderBottom: '2px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', marginTop: '16px' }}>ER Queue / Recent</h3>
                {caseSnapshots.length === 0 ? <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>No recent patients</p> : null}
                {caseSnapshots.map((p, idx) => (
                  <div key={idx} style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '6px', borderLeft: `4px solid ${p.severity === 'Critical' ? '#d32f2f' : 'var(--color-primary)'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-h)' }}>{p.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px', fontWeight: 500 }}>{p.diagnosis}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '6px', opacity: 0.8 }}>ID: {p.caseId?.split('-')[0]} • {p.timestamp}</div>
                    <button 
                      onClick={() => setResult(p.fullData)}
                      style={{ marginTop: '10px', width: '100%', padding: '6px', backgroundColor: 'var(--color-background)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                    >
                      Reopen Case
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Main Content Wrapper */}
            <div style={{ marginLeft: user ? '260px' : '0', padding: '0 24px', paddingTop: '24px' }}>
            
              {user && notifPerm !== 'granted' && typeof Notification !== 'undefined' && (
                 <button onClick={() => Notification.requestPermission().then(p => setNotifPerm(p))} style={{ backgroundColor: '#f57c00', color: '#fff', padding: '12px 24px', border: 'none', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                     🔔 Enable Critical Background Notifications
                 </button>
              )}

            {/* Real-time Socket Alert Banner */}
            {criticalAlert && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: criticalAlert.escalated ? 'rgba(183, 28, 28, 0.98)' : 'rgba(211, 47, 47, 0.95)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', border: criticalAlert.escalated ? '12px solid #ffeb3b' : 'none' }}>
                 <h1 style={{ color: '#fff', fontSize: '42px', margin: '0 0 24px 0', textAlign: 'center', animation: criticalAlert.escalated && !criticalAlert.acknowledged ? 'pulse-white 0.5s infinite' : 'none' }}>
                    {criticalAlert.noActionTaken ? '🔥 CRITICAL ESCALATION: NO ACTIONS LOGGED 🔥' : criticalAlert.escalated && !criticalAlert.acknowledged ? '🔥 UNACKNOWLEDGED CRITICAL ESCALATION 🔥' : '🚨 CRITICAL DETERIORATION 🚨'}
                 </h1>
                 <div style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '12px', textAlign: 'center', width: '90%', maxWidth: '600px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', transition: 'all 0.3s', opacity: criticalAlert.acknowledged && (!criticalAlert.actions || criticalAlert.actions.length > 0) ? 0.9 : 1 }}>
                    <h2 style={{ color: '#d32f2f', margin: '0 0 16px 0', fontSize: '32px', textDecoration: criticalAlert.acknowledged && !criticalAlert.noActionTaken ? 'line-through' : 'none' }}>{criticalAlert.patientName}</h2>
                    <p style={{ fontSize: '20px', fontWeight: 'bold' }}>Alert: {criticalAlert.alertType} ({criticalAlert.severity})</p>
                    <p style={{ fontSize: '16px', color: '#666', marginBottom: '32px' }}>Time: {criticalAlert.timestamp}</p>
                    
                    {criticalAlert.acknowledged ? (
                      <div style={{ textAlign: 'left', marginTop: '24px', borderTop: '2px solid #eee', paddingTop: '24px' }}>
                        <div style={{ color: '#2e7d32', fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
                          ✅ Acknowledged by {criticalAlert.acknowledgedBy?.name || criticalAlert.acknowledgedBy || 'Unknown'}
                        </div>
                        
                        <div style={{ marginBottom: '16px' }}>
                           <h3 style={{ fontSize: '16px', color: '#424242', marginBottom: '12px' }}>📝 Log Immediate Action</h3>
                           <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                              {['Oxygen started', 'IV fluids started', 'Intubation initiated', 'CPR initiated', 'Consultant informed', 'Shifted to ICU'].map(act => (
                                 <button key={act} onClick={() => socket.emit("log_action", { caseId: criticalAlert.caseId, action: act, user })} style={{ padding: '8px 16px', backgroundColor: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9', borderRadius: '16px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s' }}>+ {act}</button>
                              ))}
                           </div>
                        </div>
                        
                        {criticalAlert.actions && criticalAlert.actions.length > 0 && (
                           <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #1976d2' }}>
                              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Action Timeline:</h4>
                              {criticalAlert.actions.map((al, idx) => (
                                 <div key={idx} style={{ fontSize: '14px', color: '#333', marginBottom: '4px' }}>
                                    <strong style={{ color: '#0d47a1' }}>{al.timestamp}</strong> - {al.action} <em style={{ color: '#757575' }}>({al.performedBy?.name || al.performedBy})</em>
                                 </div>
                              ))}
                           </div>
                        )}

                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '32px' }}>
                          <button onClick={() => setCriticalAlert(null)} style={{ padding: '12px 24px', backgroundColor: '#e0e0e0', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Minimize Menu</button>
                          <button onClick={() => {
                             const mergedAudit = [...(criticalAlert.fullData.auditTrail || []), ...(criticalAlert.actions || []).map(a => `[TELEMETRY] ${a.action} by ${a.performedBy?.name || a.performedBy} at ${a.timestamp}`)];
                             const mergedSummary = (criticalAlert.fullData.dischargeSummary || '') + (criticalAlert.actions || []).map(a => `\n-> ${a.timestamp}: ${a.action} (${a.performedBy?.name || a.performedBy})`).join('');
                             setResult({...criticalAlert.fullData, auditTrail: mergedAudit, dischargeSummary: mergedSummary});
                             setCriticalAlert(null);
                          }} style={{ padding: '12px 24px', backgroundColor: '#d32f2f', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Analyze Case Now</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                        <button onClick={() => {
                           socket.emit("ack_alert", { caseId: criticalAlert.caseId, user });
                        }} style={{ padding: '16px 32px', backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>✅ Acknowledge</button>
                        <button onClick={() => {
                           setResult(criticalAlert.fullData);
                           setCriticalAlert(null);
                        }} style={{ padding: '16px 32px', backgroundColor: '#d32f2f', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(211,47,47,0.4)' }}>Open Case Instantly</button>
                      </div>
                    )}
                 </div>
              </div>
            )}

              <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <button onClick={() => alert("1. Enter patient data\n2. Click analyze\n3. Follow plan")} style={{ background: '#e3f2fd', border: '1px solid #90caf9', color: '#1565c0', width: '32px', height: '32px', borderRadius: '50%', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   ?
                 </button>
                 <button onClick={() => {
                    const val = !silentMode;
                    setSilentMode(val);
                    localStorage.setItem('silentMode', val);
                 }} style={{ background: 'none', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '20px', fontSize: '14px', cursor: 'pointer', backgroundColor: silentMode ? '#424242' : '#fff', color: silentMode ? '#fff' : 'var(--text)' }}>
                   {silentMode ? '🔕 Silent' : '🔔 Loud'}
                 </button>
                 <div style={{ fontWeight: 'bold', padding: '6px 12px', borderRadius: '20px', backgroundColor: isOnline ? '#e8f5e9' : '#ffebee', color: isOnline ? '#2e7d32' : '#c62828', border: `1px solid ${isOnline ? '#2e7d32' : '#c62828'}`, fontSize: '14px' }}>
                   {isOnline ? '🟢 Online' : '🔴 Offline'}
                 </div>
                 <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>Logout ({user?.name})</button>
              </div>

              {/* 🚨 CRITICAL NOTE TOAST */}
              {noteAlert && (
                <div 
                  onClick={() => {
                    const fullPt = patientSnapshot.find(s => s.caseId === noteAlert.caseId);
                    if (fullPt) setResult(fullPt);
                    setNoteAlert(null);
                  }}
                  style={{ 
                    position: 'fixed', 
                    top: '20px', 
                    left: '50%', 
                    transform: 'translateX(-50%)', 
                    zIndex: 9999, 
                    backgroundColor: '#d32f2f', 
                    color: '#fff', 
                    padding: '16px 32px', 
                    borderRadius: '40px', 
                    boxShadow: '0 8px 32px rgba(211,47,47,0.4)', 
                    cursor: 'pointer', 
                    fontWeight: 900, 
                    fontSize: '16px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    animation: 'slide-down 0.3s ease-out, pulse-red 1.5s infinite' 
                  }}
                >
                  <span style={{ fontSize: '20px' }}>⚠️</span>
                  <span>CRITICAL NOTE by {noteAlert.entry.user.name}: {noteAlert.message || 'Potential Deterioration'}</span>
                  <style>{`
                    @keyframes slide-down {
                      from { transform: translate(-50%, -100px); opacity: 0; }
                      to { transform: translate(-50%, 0); opacity: 1; }
                    }
                    @keyframes pulse-red {
                      0% { box-shadow: 0 8px 32px rgba(211,47,47,0.4); }
                      50% { box-shadow: 0 8px 48px rgba(211,47,47,0.7); transform: translateX(-50%) scale(1.02); }
                      100% { box-shadow: 0 8px 32px rgba(211,47,47,0.4); }
                    }
                  `}</style>
                </div>
              )}

              <header style={{ marginBottom: 32, textAlign: 'center', marginTop: '32px' }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-primary)' }}>
                  Clinical Intelligence
                </h1>
                <p style={{ fontSize: 16 }}>Minimal Fast-Track Evaluation</p>
              </header>

              {error && (
                <div style={{ background: '#ffebe9', color: '#a30000', padding: 16, borderRadius: 12, marginBottom: 24, textAlign: 'center' }}>
                  {error}
                </div>
              )}

              {!result ? (
                user?.role === 'consultant' ? (
                   <CommandDashboard 
                      snapshot={patientSnapshot} 
                      triageList={triageList} 
                      resourceStatus={resourceStatus}
                      onOpenCase={setResult} 
                      user={user} 
                   />
                ) : user?.role === 'admin' ? (
                   <AdminDashboard snapshot={patientSnapshot} />
                ) : (
                   <DataEntryScreen onSubmit={handleAnalyze} loading={loading} />
                )
              ) : (
                <ResultsScreen result={result} onReset={handleReset} user={user} silentMode={silentMode} socket={socket} />
              )}

              {suppressedBadge && (
                 <div style={{ position: 'fixed', bottom: '24px', left: '24px', backgroundColor: '#424242', color: '#fff', padding: '10px 20px', borderRadius: '24px', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 99999 }}>
                    🛡️ {suppressedBadge}
                 </div>
              )}
            </div>
          </>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
