import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';

const socket = io('http://localhost:5000');

const BillingDashboard = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [fixesData, setFixesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [guard, setGuard] = useState(null);

  useEffect(() => {
    fetchReport();
    fetchFixes();
    
    socket.on('billing_risk_alert', (data) => {
      setAlerts(prev => [{ ...data, type: 'RISK', time: Date.now() }, ...prev].slice(0, 10));
    });

    socket.on('revenue_leak_alert', (data) => {
      setAlerts(prev => [{ ...data, type: 'LEAK', time: Date.now() }, ...prev].slice(0, 10));
    });

    return () => {
      socket.off('billing_risk_alert');
      socket.off('revenue_leak_alert');
    };
  }, [caseId]);

  const fetchFixes = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/clinical/billing/fixes/${caseId}`);
      const data = await res.json();
      if (!data.error) {
        setFixesData(data);
        fetchGuard(); // Update guard status when fixes change
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGuard = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/clinical/claim/guard/${caseId}`);
      const data = await res.json();
      setGuard(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReport = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/clinical/billing/${caseId}`);
      const data = await res.json();
      if (!data.error) {
        setReport(data);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const applyFix = async (fix) => {
    try {
      const token = localStorage.getItem('token') || 'fallback-token';
      const res = await fetch("/api/clinical/notes/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          caseId,
          text: fix.autoText,
          source: "ClaimAutoFix"
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Remediation note applied to clinical record!');
        fetchFixes(); // Refresh fixes and guard status
      } else {
        alert('❌ Failed to apply fix: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error connecting to server.');
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>🔄 Analyzing Clinical Evidence...</div>;
  if (!report) return <div style={{ padding: '40px', textAlign: 'center' }}>❌ No billing data available for this case.</div>;

  const scoreColor = report.claimScore > 80 ? '#2e7d32' : report.claimScore > 60 ? '#f9a825' : '#c62828';

  // Grouping handled by backend in v2
  const groupedFixes = fixesData?.fixes || {};

  return (
    <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh', padding: '24px', fontFamily: '"Inter", sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#1a237e' }}>💰 Billing + Claim Intelligence</h1>
          <p style={{ margin: 0, color: '#666' }}>Production v3.2 | Case: {caseId} | Patient: {report.patientName}</p>
        </div>
        <button onClick={() => navigate('/')} style={{ padding: '10px 20px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer' }}>Back to Command Center</button>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#666', fontSize: '13px', marginBottom: '8px' }}>Global Claim Score</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: scoreColor }}>{report.claimScore}</div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>Approval Prob: {report.claimScore}%</div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#666', fontSize: '13px', marginBottom: '8px' }}>Confidence Score</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1565c0' }}>{report.confidenceScore}%</div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>Data Density: {report.telemetryStats.density} rd/hr</div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#666', fontSize: '13px', marginBottom: '8px' }}>Revenue Potential</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2e7d32' }}>${(report.billingItems.length * 450).toLocaleString()}</div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>{report.billingItems.length} Billable Items</div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#666', fontSize: '13px', marginBottom: '8px' }}>Active Risks</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#e65100' }}>{report.denialRisks.length}</div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>{report.revenueLeaks.length} Revenue Leaks</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '20px' }}>
        {/* Billing Items Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>📋 Evidence-Backed Billing Units</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #f5f5f5', color: '#666' }}>
                  <th style={{ padding: '12px' }}>Item</th>
                  <th style={{ padding: '12px' }}>Units</th>
                  <th style={{ padding: '12px' }}>Strength</th>
                  <th style={{ padding: '12px' }}>Defense Block (Indication/Intervention/Response)</th>
                </tr>
              </thead>
              <tbody>
                {report.billingItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 'bold' }}>{item.type}</div>
                      <div style={{ fontSize: '11px', color: '#999' }}>{item.code}</div>
                    </td>
                    <td style={{ padding: '12px' }}>{item.units || 1} {item.type === 'ICU_STAY' ? 'Days' : 'Tasks'}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '11px', 
                        fontWeight: 'bold',
                        backgroundColor: item.strength === 'STRONG' ? '#e8f5e9' : item.strength === 'MODERATE' ? '#fff3e0' : '#ffebee',
                        color: item.strength === 'STRONG' ? '#2e7d32' : item.strength === 'MODERATE' ? '#ef6c00' : '#c62828'
                      }}>{item.strength}</span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontSize: '13px' }}><strong>ID:</strong> {item.defense.indication}</div>
                      <div style={{ fontSize: '13px' }}><strong>IV:</strong> {item.defense.intervention}</div>
                      <div style={{ fontSize: '13px', color: '#1b5e20' }}><strong>RS:</strong> {item.defense.response}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Production-Grade Auto-Fix Panel */}
          {fixesData && fixesData.fixes?.length > 0 && (
            <div style={{ 
              backgroundColor: '#fff', 
              borderRadius: '16px', 
              padding: '24px', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              border: '2px solid #1a237e'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '20px', color: '#1a237e', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  🛡️ Claim Auto-Fix Intelligence 
                  <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#e8eaf6', color: '#1a237e', borderRadius: '50px' }}>PRO Grade v1.0</span>
                </h3>
                <div style={{ textAlign: 'right' }}>
                   <div style={{ fontSize: '12px', color: '#666' }}>Projected Claim Score</div>
                   <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1b5e20' }}>
                     {report.claimScore} → {fixesData.projectedScore}
                     <span style={{ fontSize: '14px', marginLeft: '8px', color: '#2e7d32' }}>
                       (+{fixesData.projectedScore - report.claimScore})
                     </span>
                   </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {['CRITICAL', 'HIGH', 'MODERATE'].map(sev => groupedFixes[sev] && (
                  <div key={sev}>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: 'bold', 
                      color: sev === 'CRITICAL' ? '#d32f2f' : sev === 'HIGH' ? '#f57c00' : '#1976d2',
                      marginBottom: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>
                      {sev} PRIORITY FIXES ({groupedFixes[sev].length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {groupedFixes[sev].map((fix, idx) => (
                        <div key={idx} style={{ 
                          border: '1px solid #e0e0e0', 
                          borderRadius: '12px', 
                          padding: '16px',
                          backgroundColor: sev === 'CRITICAL' ? '#fff5f5' : '#fff',
                          transition: 'transform 0.2s',
                          cursor: 'default'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                             <strong style={{ fontSize: '15px', color: '#333' }}>{fix.issue}</strong>
                             <div style={{ fontSize: '12px', color: '#2e7d32', fontWeight: 'bold' }}>+{fix.confidenceImpact/2} pts</div>
                          </div>
                          
                          <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                             {fix.medicoLegalRisk}
                          </div>

                          <div style={{ 
                            backgroundColor: '#263238', 
                            color: '#eceff1', 
                            padding: '12px', 
                            borderRadius: '8px', 
                            fontFamily: '"Cascadia Code", "Fira Code", monospace', 
                            fontSize: '12px',
                            position: 'relative',
                            lineHeight: '1.5',
                            border: '1px solid #37474f'
                          }}>
                            {fix.autoText}
                            <div style={{ display: 'flex', gap: '8px', position: 'absolute', right: '8px', top: '8px' }}>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(fix.autoText);
                                  alert('📋 Claim remediation text copied to clipboard!');
                                }}
                                style={{ 
                                  backgroundColor: '#455a64', 
                                  color: '#fff', 
                                  border: 'none', 
                                  borderRadius: '4px',
                                  padding: '4px 12px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontWeight: 'bold'
                                }}
                              >📋 Copy</button>
                              <button 
                                onClick={() => applyFix(fix)}
                                style={{ 
                                  backgroundColor: '#1a237e', 
                                  color: '#fff', 
                                  border: 'none', 
                                  borderRadius: '4px',
                                  padding: '4px 12px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontWeight: 'bold',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                              >⚡ Apply Fix</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Claim Guard Status (NEW) */}
          {guard && (
            <div style={{ 
              backgroundColor: guard.status === 'APPROVED' ? '#e8f5e9' : guard.status === 'WARNING' ? '#fff3e0' : '#ffebee', 
              borderRadius: '16px', 
              padding: '24px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              borderLeft: `10px solid ${guard.status === 'APPROVED' ? '#2e7d32' : guard.status === 'WARNING' ? '#ef6c00' : '#c62828'}`
            }}>
              <h3 style={{ margin: 0, fontSize: '22px', display: 'flex', alignItems: 'center', gap: '12px', color: '#1a237e' }}>
                {guard.status === 'APPROVED' ? '✅ CLAIM SAFE' : guard.status === 'WARNING' ? '⚠️ CLAIM AT RISK' : '🚫 CLAIM BLOCKED'}
              </h3>
              <p style={{ margin: '12px 0', color: '#666', fontSize: '14px' }}>
                {guard.recommendation}
              </p>
              {guard.reasons.length > 0 && (
                <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px', fontSize: '13px', color: '#c62828' }}>
                  {guard.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
              
              <button 
                disabled={!guard.safeToSubmit}
                onClick={() => alert('🚀 Claim submitted to clearinghouse for processing.')}
                style={{ 
                  width: '100%', 
                  padding: '16px', 
                  borderRadius: '12px', 
                  backgroundColor: guard.safeToSubmit ? '#1a237e' : '#e0e0e0',
                  color: guard.safeToSubmit ? '#fff' : '#999',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: guard.safeToSubmit ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease'
                }}
              >
                {guard.safeToSubmit ? '🚀 Submit Pre-Verified Claim' : '[ FIX REQUIRED BEFORE SUBMISSION ]'}
              </button>
            </div>
          )}

          {/* Sidebar Alerts */}
          {/* Risks */}
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#c62828' }}>🚩 Denial Risks</h3>
            {report.denialRisks.map((risk, idx) => (
              <div key={idx} style={{ padding: '12px', backgroundColor: '#fff9f9', borderLeft: '4px solid #c62828', marginBottom: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#c62828' }}>{risk.severity} SEVERITY</div>
                <div style={{ fontSize: '13px' }}>{risk.message}</div>
              </div>
            ))}
          </div>

          {/* Leaks */}
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#2e7d32' }}>💸 Revenue Leaks</h3>
            {report.revenueLeaks.map((leak, idx) => (
              <div key={idx} style={{ padding: '12px', backgroundColor: '#f1f8e9', borderLeft: '4px solid #2e7d32', marginBottom: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{leak.type}</div>
                <div style={{ fontSize: '13px' }}>{leak.message}</div>
              </div>
            ))}
          </div>

          {/* Continuity */}
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>⏱️ Continuity Check</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span>Log Status:</span>
              <span style={{ fontWeight: 'bold', color: report.telemetryStats.continuity === 'CONTINUOUS' ? '#2e7d32' : '#c62828' }}>{report.telemetryStats.continuity}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Detected {report.telemetryStats.gapCount} gaps exceeding 2h threshold.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;
