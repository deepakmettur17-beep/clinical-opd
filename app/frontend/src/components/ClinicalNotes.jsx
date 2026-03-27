import React, { useState, useEffect, useMemo } from 'react';

const ClinicalNotes = ({ caseId, user, socket }) => {
  const [activeTab, setActiveTab] = useState('Doctor');
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roundId] = useState(`Round-${Math.floor(Date.now() / (1000 * 60 * 60 * 12))}-${Date.now()}`); // Simple round partition
  const [addendumTo, setAddendumTo] = useState(null);
  
  const [formData, setFormData] = useState({
    Nurse: { vitals: '', medications: '', observations: '' },
    Doctor: { diagnosis: '', assessment: '', plan: '' },
    Specialist: { opinion: '', advice: '' }
  });

  const summary = useMemo(() => {
    const today = new Date().toLocaleDateString();
    const todayNotes = notes.filter(n => new Date(n.timestamp).toLocaleDateString() === today);
    return {
      total: todayNotes.length,
      nurse: todayNotes.filter(n => n.type === 'Nurse').length,
      doctor: todayNotes.filter(n => n.type === 'Doctor').length,
      specialist: todayNotes.filter(n => n.type === 'Specialist').length,
      critical: todayNotes.filter(n => n.isCritical).length
    };
  }, [notes]);

  useEffect(() => {
    fetchNotes();
    
    const handleNewNote = (data) => {
      if (data.caseId === caseId) {
        setNotes(prev => [data.entry, ...prev]);
      }
    };

    const handleAddendum = (data) => {
      if (data.caseId === caseId) {
        setNotes(prev => [data.entry, ...prev]);
      }
    };

    const handleCriticalAlert = (data) => {
        if (data.caseId === caseId) {
            // Optional: Show a temporary notification or toast here
            console.warn("CRITICAL NOTE DETECTED!", data.entry);
        }
    };

    socket.on('note_added', handleNewNote);
    socket.on('note_addendum', handleAddendum);
    socket.on('critical_note_alert', handleCriticalAlert);

    return () => {
      socket.off('note_added', handleNewNote);
      socket.off('note_addendum', handleAddendum);
      socket.off('critical_note_alert', handleCriticalAlert);
    };
  }, [caseId]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clinical/notes/${caseId}`);
      const data = await res.json();
      setNotes(data.reverse()); // Show newest first
    } catch (e) {
      console.error("Failed to fetch notes", e);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e, field) => {
    setFormData({
      ...formData,
      [activeTab]: {
        ...formData[activeTab],
        [field]: e.target.value
      }
    });
  };

  const submitNote = async () => {
    const content = formData[activeTab];
    if (Object.values(content).every(v => !v.trim())) return;

    try {
      await fetch('/api/clinical/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          type: activeTab,
          content,
          user: user || { name: 'Clinician', role: activeTab },
          roundId: addendumTo ? addendumTo.roundId : roundId,
          parentNoteId: addendumTo ? addendumTo.id : null,
          isAddendum: !!addendumTo
        })
      });
      // Clear form
      setFormData({
        ...formData,
        [activeTab]: Object.fromEntries(Object.keys(content).map(k => [k, '']))
      });
      setAddendumTo(null);
    } catch (e) {
      console.error("Failed to submit note", e);
    }
  };

  // Group notes by round then hierarchy
  const groupedRounds = useMemo(() => {
    const groups = {};
    const addendums = notes.filter(n => n.isAddendum);
    const parents = notes.filter(n => !n.isAddendum);

    parents.forEach(p => {
      const rId = p.roundId || 'Historic';
      if (!groups[rId]) groups[rId] = [];
      
      const pAddendums = addendums.filter(a => a.parentNoteId === p.id);
      groups[rId].push({ ...p, addendums: pAddendums });
    });

    return Object.entries(groups).sort((a, b) => b[0].split('-').pop() - a[0].split('-').pop());
  }, [notes]);

  const getRoundLabel = (id) => {
    if (id === 'Historic') return '📜 Historical Records';
    const ts = parseInt(id.split('-').pop());
    const hour = new Date(ts).getHours();
    const label = hour < 13 ? '🕒 Morning Round' : '🕒 Evening Round';
    return `${label} (${new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
  };

  const renderNoteCard = (note, isChild = false) => {
    const isCritical = note.isCritical;
    const cardStyle = {
      padding: '16px',
      background: isChild ? '#ffffff' : isCritical ? '#fff8f8' : '#fafafa',
      borderRadius: '12px',
      borderLeft: isCritical ? '6px solid #d32f2f' : `4px solid ${note.type === 'Nurse' ? '#4caf50' : note.type === 'Doctor' ? '#1565c0' : '#f57c00'}`,
      boxShadow: isCritical ? '0 4px 12px rgba(211,47,47,0.1)' : 'none',
      marginBottom: isChild ? '12px' : '20px',
      marginLeft: isChild ? '32px' : '0',
      position: 'relative',
      animation: isCritical && !isChild ? 'pulse-critical 2s infinite' : 'none'
    };

    return (
      <div key={note.id} style={cardStyle}>
        {isCritical && !isChild && (
          <div style={{ position: 'absolute', top: '-10px', right: '16px', background: '#d32f2f', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '2px 8px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
            ⚠ CRITICAL NOTE
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '8px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#333' }}>{note.user?.name}</div>
            <div style={{ fontSize: '11px', color: '#666', fontWeight: 600 }}>{note.type} {note.isAddendum ? '• Addendum' : ''}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#1565c0' }}>{new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div style={{ fontSize: '10px', color: '#9e9e9e' }}>{new Date(note.timestamp).toLocaleDateString()}</div>
          </div>
        </div>
        <div style={{ fontSize: '13px', color: '#424242', lineHeight: '1.6' }}>
          {Object.entries(note.content).map(([key, val]) => (
            val && <div key={key} style={{ marginBottom: '6px' }}>
              <span style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: 800, color: '#9e9e9e', marginRight: '8px', width: '80px', display: 'inline-block' }}>{key}</span>
              <span>{val}</span>
            </div>
          ))}
        </div>
        {!note.isAddendum && (
          <button 
            onClick={() => { setAddendumTo(note); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            style={{ 
               marginTop: '12px', 
               background: '#e3f2fd', 
               border: '1px solid #90caf9', 
               color: '#1565c0', 
               fontSize: '11px', 
               fontWeight: 900, 
               cursor: 'pointer', 
               padding: '4px 10px', 
               borderRadius: '6px',
               display: 'flex', 
               alignItems: 'center', 
               gap: '4px' 
            }}
          >
            ↳ ADD ADDENDUM
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e0e0e0', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
      <style>{`
        @keyframes pulse-critical {
          0% { border-left-color: #d32f2f; }
          50% { border-left-color: #ff5252; }
          100% { border-left-color: #d32f2f; }
        }
      `}</style>
      
      {/* 📊 TODAY SUMMARY PANEL */}
      <div style={{ background: '#fff8e1', padding: '12px 24px', borderBottom: '1px solid #ffe082', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '18px' }}>📊</span>
            <div>
               <div style={{ fontSize: '13px', fontWeight: 900, color: '#f57f17' }}>TODAY SUMMARY</div>
               <div style={{ fontSize: '11px', color: '#795548', fontWeight: 700 }}>{summary.total} Total Notes • {summary.nurse} Nurse • {summary.doctor} Doctor • {summary.specialist} Specialist</div>
            </div>
         </div>
         {summary.critical > 0 && (
            <div style={{ background: '#d32f2f', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 900, animation: 'pulse-critical 1.5s infinite' }}>
               🚨 {summary.critical} CRITICAL EVENT{summary.critical > 1 ? 'S' : ''}
            </div>
         )}
      </div>

      <div style={{ background: '#f8f9fa', padding: '16px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#1a237e' }}>📋 Clinical Notes</h3>
        <div style={{ display: 'flex', background: '#eee', padding: '3px', borderRadius: '10px' }}>
          {['Nurse', 'Doctor', 'Specialist'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setAddendumTo(null); }}
              style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#1565c0' : '#616161', transition: 'all 0.2s' }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px', background: addendumTo ? '#e3f2fd' : '#fff', borderBottom: '1px solid #eee' }}>
        {addendumTo && (
           <div style={{ marginBottom: '16px', padding: '8px 16px', background: '#fff', borderRadius: '8px', borderLeft: '4px solid #1565c0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#1565c0' }}>Writing Addendum for {addendumTo.user?.name}'s note ({new Date(addendumTo.timestamp).toLocaleTimeString()})</div>
              <button onClick={() => setAddendumTo(null)} style={{ border: 'none', background: 'transparent', color: '#d32f2f', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
           </div>
        )}
        
        {activeTab === 'Nurse' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <input placeholder="VITALS" value={formData.Nurse.vitals} onChange={(e) => handleInputChange(e, 'vitals')} style={inputStyle} />
            <input placeholder="MEDICATIONS" value={formData.Nurse.medications} onChange={(e) => handleInputChange(e, 'medications')} style={inputStyle} />
            <textarea placeholder="OBSERVATIONS" value={formData.Nurse.observations} onChange={(e) => handleInputChange(e, 'observations')} style={{ ...inputStyle, gridColumn: 'span 2', minHeight: '60px' }} />
          </div>
        )}
        
        {activeTab === 'Doctor' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input placeholder="DIAGNOSIS" value={formData.Doctor.diagnosis} onChange={(e) => handleInputChange(e, 'diagnosis')} style={inputStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                 <textarea placeholder="ASSESSMENT" value={formData.Doctor.assessment} onChange={(e) => handleInputChange(e, 'assessment')} style={{ ...inputStyle, minHeight: '60px' }} />
                 <textarea placeholder="PLAN" value={formData.Doctor.plan} onChange={(e) => handleInputChange(e, 'plan')} style={{ ...inputStyle, minHeight: '60px' }} />
              </div>
           </div>
        )}

        {activeTab === 'Specialist' && (
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <textarea placeholder="OPINION" value={formData.Specialist.opinion} onChange={(e) => handleInputChange(e, 'opinion')} style={{ ...inputStyle, minHeight: '80px' }} />
              <textarea placeholder="ADVICE" value={formData.Specialist.advice} onChange={(e) => handleInputChange(e, 'advice')} style={{ ...inputStyle, minHeight: '80px' }} />
           </div>
        )}

        <button onClick={submitNote} style={{ marginTop: '20px', width: '100%', padding: '14px', backgroundColor: '#1565c0', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' }}>
          POST {addendumTo ? 'ADDENDUM' : `${activeTab.toUpperCase()} NOTE`}
        </button>
      </div>

      <div style={{ padding: '24px', maxHeight: '600px', overflowY: 'auto', background: '#fdfdfd' }}>
        {groupedRounds.map(([rId, notesInRound]) => {
           // Sort critical to top of round
           const sortedNotes = [...notesInRound].sort((a, b) => (b.isCritical ? 1 : 0) - (a.isCritical ? 1 : 0));
           return (
              <div key={rId} style={{ marginBottom: '40px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#1a237e', textTransform: 'uppercase', letterSpacing: '1px' }}>{getRoundLabel(rId)}</div>
                    <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }} />
                 </div>
                 {sortedNotes.map(parent => (
                    <div key={parent.id}>
                       {renderNoteCard(parent)}
                       {parent.addendums.map(child => renderNoteCard(child, true))}
                    </div>
                 ))}
              </div>
           );
        })}
        {notes.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#b0bec5' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>No Clinical Records Found</div>
            <div style={{ fontSize: '13px' }}>Document your first round to begin the timeline.</div>
          </div>
        )}
      </div>
    </div>
  );
};

const inputStyle = {
  padding: '12px 16px',
  borderRadius: '10px',
  border: '1px solid #e0e0e0',
  fontSize: '14px',
  fontWeight: 600,
  outline: 'none',
  width: '100%',
  transition: 'all 0.2s',
  background: '#fff'
};

export default ClinicalNotes;
