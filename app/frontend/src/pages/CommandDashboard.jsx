import React from 'react';

const CommandDashboard = ({ snapshot = [], triageList = [], resourceStatus = { icuQueue: [], ventilatorQueue: [], overloadWarnings: [] }, onOpenCase }) => {
  const sortedPatients = [...snapshot].sort((a, b) => {
    const isACritical = a.severity === 'Critical' || a.triageLevel === 'RED' || a.alertsActive;
    const isBCritical = b.severity === 'Critical' || b.triageLevel === 'RED' || b.alertsActive;
    if (isACritical && !isBCritical) return -1;
    if (!isACritical && isBCritical) return 1;
    return b.lastUpdated - a.lastUpdated; 
  });

  const getRowColor = (pt) => {
    if (pt.alertsActive) return '#ffebee';
    if (pt.severity === 'Critical' || pt.triageLevel === 'RED') return '#fff8e1';
    return '#fff';
  };

  const getStatusBadge = (pt) => {
    if (pt.alertsActive) return <span style={{ color: '#c62828', fontWeight: 'bold' }}>🚨 ESCALATING</span>;
    if (pt.severity === 'Critical' || pt.triageLevel === 'RED') return <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>🔴 CRITICAL</span>;
    if (pt.severity === 'Moderate' || pt.triageLevel === 'YELLOW') return <span style={{ color: '#f57c00', fontWeight: 'bold' }}>🟠 MODERATE</span>;
    return <span style={{ color: '#388e3c', fontWeight: 'bold' }}>🟢 STABLE</span>;
  };

  const getSlaStatus = (pt) => {
     if (!pt.tasks || pt.tasks.length === 0) return <span style={{color:'#9e9e9e'}}>-</span>;
     const pending = pt.tasks.filter(t => t.status === 'pending');
     if (pending.length === 0) return <span style={{color:'#2e7d32', fontWeight:'bold'}}>✅ Complete</span>;
     
     const now = Date.now();
     const overdue = pending.find(t => now > t.dueBy);
     if (overdue) return <span style={{color:'#d32f2f', fontWeight:'bold'}}>⏰ OVERDUE</span>;
     
     const dueSoon = pending.find(t => (t.dueBy - now) < 120000); 
     if (dueSoon) return <span style={{color:'#e65100', fontWeight:'bold'}}>⏳ Due Soon</span>;
     
     return <span style={{color:'#1565c0', fontWeight:'bold'}}>🟢 On-Time</span>;
  };

   const urgencyStyles = {
    CRITICAL: { bg: '#ffebee', border: '#d32f2f', text: '#c62828', badge: '#d32f2f' },
    HIGH:     { bg: '#fff3e0', border: '#fb8c00', text: '#e65100', badge: '#f57c00' },
    MODERATE: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32', badge: '#4caf50' }
  };

  return (
    <div style={{ backgroundColor: '#f8f9fa', padding: '24px', borderRadius: '12px', minHeight: '600px' }}>
       {/* ─── Hospital Triage Board Table ─── */}
       {triageList && triageList.length > 0 && (
          <div style={{ marginBottom: '40px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
             <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #ffffff, #f9f9f9)' }}>
                <div>
                   <h2 style={{ fontSize: '20px', color: '#0d47a1', margin: 0, fontWeight: 800 }}>🛡️ Hospital Triage Priority Board</h2>
                   <p style={{ color: '#757575', fontSize: '13px', marginTop: '4px' }}>Patients sorted by computed deterioration risk score.</p>
                </div>
                <div style={{ padding: '6px 14px', background: '#e3f2fd', color: '#1565c0', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>
                   Live Updates Active
                </div>
             </div>

             <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                   <tr style={{ backgroundColor: '#f5f5f5', color: '#616161', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      <th style={{ padding: '16px 24px' }}>Patient / Ward</th>
                      <th style={{ padding: '16px 24px', textAlign: 'center' }}>Scoring</th>
                      <th style={{ padding: '16px 24px' }}>Urgency Tier</th>
                      <th style={{ padding: '16px 24px' }}>Primary Triage Reason</th>
                      <th style={{ padding: '16px 24px', textAlign: 'right' }}>Action</th>
                   </tr>
                </thead>
                <tbody>
                   {triageList.map(pt => {
                      const style = urgencyStyles[pt.urgency] || urgencyStyles.MODERATE;
                      const isCritical = pt.urgency === 'CRITICAL';
                      return (
                         <tr 
                            key={pt.caseId} 
                            onClick={() => {
                               const fullPt = snapshot.find(s => s.caseId === pt.caseId);
                               onOpenCase(fullPt || pt);
                            }}
                            style={{ 
                               borderBottom: '1px solid #f0f0f0', 
                               backgroundColor: isCritical ? '#fff5f5' : '#fff', 
                               cursor: 'pointer',
                               transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = isCritical ? '#ffebee' : '#f8f9fa'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = isCritical ? '#fff5f5' : '#fff'}
                         >
                            <td style={{ padding: '18px 24px' }}>
                               <div style={{ fontSize: '15px', fontWeight: 900, color: '#333' }}>{pt.patientName}</div>
                               <div style={{ fontSize: '11px', color: '#9e9e9e', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>{pt.ward || 'ICU'} • ID: {pt.caseId?.split('-')[0]}</div>
                            </td>
                            <td style={{ padding: '18px 24px', textAlign: 'center' }}>
                               <div style={{ fontSize: '20px', fontWeight: 900, color: style.text }}>{pt.triageScore}</div>
                               <div style={{ fontSize: '9px', color: '#9e9e9e', fontWeight: 800 }}>COMPUTED</div>
                            </td>
                            <td style={{ padding: '18px 24px' }}>
                               <span style={{ 
                                  backgroundColor: style.badge, 
                                  color: '#fff', 
                                  padding: '4px 12px', 
                                  borderRadius: '20px', 
                                  fontSize: '11px', 
                                  fontWeight: 900,
                                  boxShadow: isCritical ? '0 2px 8px rgba(211,47,47,0.3)' : 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                               }}>
                                  {isCritical && <span style={{ width: '6px', height: '6px', background: '#fff', borderRadius: '50%', animation: 'ripple 1.5s infinite' }} />}
                                  {pt.urgency}
                               </span>
                            </td>
                            <td style={{ padding: '18px 24px' }}>
                               <div style={{ fontSize: '13px', color: '#424242', fontWeight: 600, maxWidth: '400px', lineHeight: 1.4 }}>
                                  {pt.reason || 'Monitoring per standard protocol'}
                               </div>
                            </td>
                            <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                               <button 
                                  className="intervene-btn"
                                  style={{ 
                                     padding: '8px 16px', 
                                     backgroundColor: '#fff', 
                                     color: style.badge, 
                                     border: `2px solid ${style.badge}`, 
                                     borderRadius: '8px', 
                                     fontWeight: 800, 
                                     fontSize: '12px',
                                     cursor: 'pointer',
                                     transition: 'all 0.2s'
                                  }}
                               >
                                  OPEN CASE
                               </button>
                            </td>
                         </tr>
                      );
                   })}
                </tbody>
             </table>
          </div>
       )}

       {/* ─── 🏥 RESOURCE STATUS PANEL ─── */}
       {resourceStatus && (
          <div style={{ marginBottom: '40px' }}>
             <h2 style={{ fontSize: '20px', color: '#1b5e20', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏥 RESOURCE STATUS <span style={{ fontSize: '12px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 10px', borderRadius: '12px' }}>Live Allocation</span>
             </h2>

             {/* Overload Alerts */}
             {resourceStatus.overloadWarnings && resourceStatus.overloadWarnings.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                   {resourceStatus.overloadWarnings.map((w, idx) => (
                      <div key={idx} style={{ backgroundColor: '#d32f2f', color: '#fff', padding: '16px 24px', borderRadius: '12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(211,47,47,0.3)', animation: 'pulse-red 2s infinite' }}>
                         <div>
                            <div style={{ fontWeight: 900, fontSize: '16px' }}>{w.message}</div>
                            <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>Recommendation: {w.recommendation}</div>
                         </div>
                         <div style={{ fontSize: '24px' }}>⚠️</div>
                      </div>
                   ))}
                </div>
             )}

             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* 1. ICU Queue */}
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
                   <div style={{ padding: '12px 16px', background: '#f1f8e9', borderBottom: '1px solid #e0e0e0', fontWeight: 800, color: '#33691e', fontSize: '13px' }}>
                      ICU PRIORITY QUEUE (TOP 3 HIGHLIGHTED)
                   </div>
                   <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                         {resourceStatus.icuQueue?.length > 0 ? resourceStatus.icuQueue.map((pt, idx) => (
                            <tr key={pt.caseId} style={{ borderBottom: '1px solid #f5f5f5', backgroundColor: idx < 3 ? '#f9fbe7' : '#fff' }}>
                               <td style={{ padding: '12px 16px' }}>
                                  <div style={{ fontWeight: 800, fontSize: '14px' }}>{pt.name}</div>
                                  <div style={{ fontSize: '11px', color: '#757575' }}>Priority {pt.priority}</div>
                               </td>
                               <td style={{ padding: '12px 16px', fontSize: '12px', color: '#616161', maxWidth: '150px' }}>{pt.reason}</td>
                               <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                  <button onClick={() => onOpenCase(snapshot.find(s => s.caseId === pt.caseId) || pt)} style={{ padding: '6px 12px', backgroundColor: '#33691e', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>VIEW</button>
                               </td>
                            </tr>
                         )) : <tr><td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: '#9e9e9e', fontSize: '12px' }}>No patients in ICU queue</td></tr>}
                      </tbody>
                   </table>
                </div>

                {/* 2. Ventilator Needed */}
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
                   <div style={{ padding: '12px 16px', background: '#e3f2fd', borderBottom: '1px solid #e0e0e0', fontWeight: 800, color: '#0d47a1', fontSize: '13px' }}>
                      VENTILATOR NEEDED
                   </div>
                   <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                         {resourceStatus.ventilatorQueue?.length > 0 ? resourceStatus.ventilatorQueue.map(pt => (
                            <tr key={pt.caseId} style={{ borderBottom: '1px solid #f5f5f5' }}>
                               <td style={{ padding: '12px 16px' }}>
                                  <div style={{ fontWeight: 800, fontSize: '14px' }}>{pt.name}</div>
                                  <div style={{ fontSize: '11px', color: '#757575' }}>Score {pt.score}</div>
                               </td>
                               <td style={{ padding: '12px 16px', fontSize: '12px', color: '#d32f2f', fontWeight: 700 }}>{pt.reason}</td>
                               <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                  <button onClick={() => onOpenCase(snapshot.find(s => s.caseId === pt.caseId) || pt)} style={{ padding: '6px 12px', backgroundColor: '#0d47a1', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>VIEW</button>
                               </td>
                            </tr>
                         )) : <tr><td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: '#9e9e9e', fontSize: '12px' }}>No active ventilator requirements</td></tr>}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
       )}

       <style>{`
          @keyframes pulse-red {
             0% { transform: scale(1); box-shadow: 0 4px 12px rgba(211,47,47,0.3); }
             50% { transform: scale(1.01); box-shadow: 0 8px 24px rgba(211,47,47,0.5); }
             100% { transform: scale(1); box-shadow: 0 4px 12px rgba(211,47,47,0.3); }
          }
          @keyframes ripple {
             0% { opacity: 1; transform: scale(1); }
             100% { opacity: 0; transform: scale(3); }
          }
          .intervene-btn:hover {
             filter: brightness(0.9);
             transform: translateY(-1px);
          }
       `}</style>

       <div style={{ margin: '32px 0 16px 0' }}>
          <h3 style={{ fontSize: '18px', color: '#424242', margin: 0 }}>Global Command Registry</h3>
       </div>
       
       <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
         <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
           <thead>
             <tr style={{ backgroundColor: '#e3f2fd', color: '#1565c0', borderBottom: '2px solid #90caf9' }}>
               <th style={{ padding: '16px' }}>Patient</th>
               <th style={{ padding: '16px' }}>Location</th>
               <th style={{ padding: '16px' }}>Diagnosis</th>
               <th style={{ padding: '16px' }}>Status</th>
               <th style={{ padding: '16px' }}>Assigned To</th>
               <th style={{ padding: '16px' }}>SLA Status</th>
               <th style={{ padding: '16px' }}>Task Trace</th>
               <th style={{ padding: '16px' }}>Last Update</th>
               <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
             </tr>
           </thead>
           <tbody>
             {sortedPatients.length === 0 ? (
               <tr><td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#666' }}>No active patients recorded in systemic array.</td></tr>
             ) : (
               sortedPatients.map(pt => (
                 <tr key={pt.caseId} style={{ borderBottom: '1px solid #eee', backgroundColor: getRowColor(pt), transition: 'background-color 0.2s' }}>
                   <td style={{ padding: '16px', fontWeight: 'bold', color: '#424242' }}>
                     {pt.patientName} <br/>
                     <span style={{ fontSize: '12px', color: '#9e9e9e', fontWeight: 'normal' }}>ID: {pt.caseId?.split('-')[0]}</span>
                   </td>
                   <td style={{ padding: '16px', fontWeight: 600 }}>{pt.location}</td>
                   <td style={{ padding: '16px' }}>{pt.diagnosis}</td>
                   <td style={{ padding: '16px' }}>{getStatusBadge(pt)}</td>
                   <td style={{ padding: '16px', fontWeight: 600 }}>{pt.assignedTo ? <span style={{color: '#1565c0'}}>{pt.assignedTo}</span> : <span style={{color: '#9e9e9e', fontWeight: 'normal'}}>Unassigned</span>}</td>
                   <td style={{ padding: '16px' }}>{getSlaStatus(pt)}</td>
                   <td style={{ padding: '16px' }}>
                     {pt.tasks && pt.tasks.length > 0 ? (
                        pt.tasks.some(t => t.status === 'pending') ? <span style={{color: '#e65100', fontWeight: 'bold', fontSize: '14px'}}>🟡 Pending</span> : <span style={{color: '#2e7d32', fontWeight: 'bold', fontSize: '14px'}}>✅ Completed</span>
                     ) : <span style={{color: '#9e9e9e'}}>-</span>}
                   </td>
                   <td style={{ padding: '16px', color: '#666', fontSize: '14px' }}>{new Date(pt.lastUpdated).toLocaleTimeString()}</td>
                   <td style={{ padding: '16px', textAlign: 'right' }}>
                     {pt.alertsActive && <span style={{ backgroundColor: '#d32f2f', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', marginRight: '12px', animation: 'pulse-white 1s infinite' }}>⚠ ACTIVE ALERT</span>}
                     <button 
                        onClick={() => onOpenCase(pt.fullData)}
                        style={{ padding: '8px 16px', backgroundColor: '#1565c0', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                       View Case
                     </button>
                   </td>
                 </tr>
               ))
             )}
           </tbody>
         </table>
       </div>
    </div>
  );
};

export default CommandDashboard;
