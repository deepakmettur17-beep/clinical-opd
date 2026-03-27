import React, { useState, useEffect } from 'react';
import { Card, Button, Selector } from '../components/UI';

const complaintOptions = [
  { label: 'Chest Pain', value: 'chest pain' },
  { label: 'Shortness of Breath', value: 'shortness of breath' },
  { label: 'Palpitations', value: 'palpitations' },
  { label: 'Syncope', value: 'syncope' },
  { label: 'Other', value: 'other' }
];

const ecgOptions = [
  { label: 'V1', value: 'V1' },
  { label: 'V2', value: 'V2' },
  { label: 'V3', value: 'V3' },
  { label: 'V4', value: 'V4' },
  { label: 'V5', value: 'V5' },
  { label: 'V6', value: 'V6' },
  { label: 'II', value: 'II' },
  { label: 'III', value: 'III' },
  { label: 'aVF', value: 'aVF' },
];

export default function DataEntryScreen({ onSubmit, loading }) {
  const [complaint, setComplaint] = useState([]);
  const [vitals, setVitals] = useState({ bp: '', pulse: '', spo2: '' });
  const [abg, setAbg] = useState({ ph: '', pco2: '', po2: '', hco3: '' });
  const [stLeads, setStLeads] = useState([]);
  const [reciprocal, setReciprocal] = useState(false);
  const [bgHistory, setBgHistory] = useState({ pastHx: '', surgHx: '', allergies: '', meds: '', habits: [] });
  const [patientInfo, setPatientInfo] = useState({ name: '', age: '', gender: '', mrd: '' });
  const [isListening, setIsListening] = useState(false);
  const [voicePreview, setVoicePreview] = useState(null);
  const [templateUsed, setTemplateUsed] = useState(null);
  const [vitalsTouched, setVitalsTouched] = useState(false);
  const [placeholderVitals, setPlaceholderVitals] = useState(false);
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasVoiceSupport = !!SpeechRecognition;
  
  const habitOptions = [
    { label: 'Smoking', value: 'Smoking' },
    { label: 'Alcohol', value: 'Alcohol' },
    { label: 'Drugs', value: 'Drugs' },
    { label: 'None', value: 'None' }
  ];

  useEffect(() => {
    const draft = localStorage.getItem("clinicalDraft");
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.complaint) setComplaint(parsed.complaint);
        if (parsed.vitals) setVitals(parsed.vitals);
        if (parsed.abg) setAbg(parsed.abg);
        if (parsed.stLeads) setStLeads(parsed.stLeads);
        if (parsed.reciprocal !== undefined) setReciprocal(parsed.reciprocal);
        if (parsed.bgHistory) setBgHistory(parsed.bgHistory);
        if (parsed.patientInfo) setPatientInfo(parsed.patientInfo);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const draft = { complaint, vitals, abg, stLeads, reciprocal, bgHistory, patientInfo };
    localStorage.setItem("clinicalDraft", JSON.stringify(draft));
  }, [complaint, vitals, abg, stLeads, reciprocal, bgHistory, patientInfo]);

  const clearDraft = () => {
    localStorage.removeItem("clinicalDraft");
    setComplaint([]);
    setVitals({ bp: '', pulse: '', spo2: '' });
    setAbg({ ph: '', pco2: '', po2: '', hco3: '' });
    setStLeads([]);
    setReciprocal(false);
    setBgHistory({ pastHx: '', surgHx: '', allergies: '', meds: '', habits: [] });
    setPatientInfo({ name: '', age: '', gender: '', mrd: '', height: '', weight: '' });
  };

  const confirmClearDraft = () => {
    if (window.confirm("Are you sure you want to clear patient data?")) {
      clearDraft();
    }
  };

  const toggleHabit = (val) => {
    setBgHistory(prev => {
      const habs = prev.habits.includes(val) ? prev.habits.filter(h => h !== val) : [...prev.habits, val];
      return { ...prev, habits: habs };
    });
  };

  const applyTemplate = (type) => {
    setTemplateUsed(type);
    setPlaceholderVitals(true);
    setVitalsTouched(false);
    
    if (type === 'Chest Pain') {
      if (!complaint.includes('chest pain')) setComplaint(prev => [...prev, 'chest pain']);
      setVitals(prev => ({ ...prev, bp: '140/90', pulse: '90', spo2: '98' }));
    } else if (type === 'Fever') {
      if (!complaint.includes('other')) setComplaint(prev => [...prev, 'other', 'Fever']);
      setVitals(prev => ({ ...prev, bp: '120/80', pulse: '100', spo2: '97' }));
    } else if (type === 'Breathlessness') {
      if (!complaint.includes('shortness of breath')) setComplaint(prev => [...prev, 'shortness of breath']);
      setVitals(prev => ({ ...prev, bp: '130/85', pulse: '110', spo2: '92' }));
    } else if (type === 'Syncope') {
      if (!complaint.includes('syncope')) setComplaint(prev => [...prev, 'syncope']);
      setVitals(prev => ({ ...prev, bp: '100/60', pulse: '60', spo2: '98' }));
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoicePreview(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const confirmVoice = () => {
    setComplaint(prev => [...prev, voicePreview]);
    setVoicePreview(null);
  };

  const focusNext = (e, nextId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById(nextId)?.focus();
    }
  };

  const toggleComplaint = (val) => {
    setComplaint(prev => prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]);
  };

  const toggleLead = (val) => {
    setStLeads(prev => prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]);
  };

  const handleSubmit = () => {
    const hasComplaint = complaint.length > 0;
    const hasVitals = vitals.bp || vitals.pulse || vitals.spo2;
    if (!hasComplaint || !hasVitals) {
      alert("Please enter minimum required data: Chief Complaint and at least 1 vital.");
      return;
    }

    if (placeholderVitals && !vitalsTouched) {
      if (!window.confirm("⚠️ Placeholder values detected — verify before submit.\n\nUse placeholder values?")) {
        return;
      }
    } else {
      if (!window.confirm("Confirm clinical submission?\n\nPress OK to Submit, or Cancel to Edit.")) {
        return;
      }
    }

    const payload = {
      visit: {
        templateUsed: templateUsed,
        chiefComplaint: complaint.join(', '),
        vitals: {
          bp: vitals.bp,
          pulse: parseInt(vitals.pulse),
          spo2: parseInt(vitals.spo2),
          abg: abg
        },
        ecg: {
          stElevationLeads: stLeads,
          reciprocalChanges: reciprocal
        },
        historyAnswers: {
          "Past medical history": bgHistory.pastHx,
          "Past surgical history": bgHistory.surgHx,
          "Drug allergy": bgHistory.allergies,
          "Current medications": bgHistory.meds,
          "Habits": bgHistory.habits.join(', ')
        }
      },
      patient: {
        name: patientInfo.name,
        age: patientInfo.age,
        gender: patientInfo.gender,
        mrd: patientInfo.mrd,
        height: patientInfo.height,
        weight: patientInfo.weight
      },
      facility: {
        hasCathLab: false // Hardcoded for demo
      }
    };
    onSubmit(payload);
  };

  const isValid = complaint.length > 0;

  return (
    <div className="fade-in">
      <Card title="Patient Information">
        <div className="input-group">
          <label className="input-label">Patient Name</label>
          <input className="input-field" placeholder="e.g. John Doe" value={patientInfo.name} onChange={(e) => setPatientInfo({...patientInfo, name: e.target.value})} />
        </div>
        <div className="input-group" style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label className="input-label">Age</label>
            <input className="input-field" type="number" placeholder="45" value={patientInfo.age} onChange={(e) => setPatientInfo({...patientInfo, age: e.target.value})} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="input-label">Gender</label>
            <select className="input-field" value={patientInfo.gender} onChange={(e) => setPatientInfo({...patientInfo, gender: e.target.value})}>
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div className="input-group" style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label className="input-label">Height (cm)</label>
            <input className="input-field" type="number" placeholder="175" value={patientInfo.height} onChange={(e) => setPatientInfo({...patientInfo, height: e.target.value})} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="input-label">Weight (kg) - Optional</label>
            <input className="input-field" type="number" placeholder="70" value={patientInfo.weight} onChange={(e) => setPatientInfo({...patientInfo, weight: e.target.value})} />
          </div>
        </div>
        <div className="input-group">
          <label className="input-label">MRD / ID (Optional)</label>
          <input className="input-field" placeholder="MRD-12345" value={patientInfo.mrd} onChange={(e) => setPatientInfo({...patientInfo, mrd: e.target.value})} />
        </div>
      </Card>

      <Card title="Background History">
        <div className="input-group">
          <label className="input-label">Past Medical History</label>
          <input className="input-field" placeholder="e.g. Hypertension, DM" value={bgHistory.pastHx} onChange={(e) => setBgHistory({...bgHistory, pastHx: e.target.value})} />
        </div>
        <div className="input-group">
          <label className="input-label">Past Surgical History</label>
          <input className="input-field" placeholder="e.g. Appendectomy 2010" value={bgHistory.surgHx} onChange={(e) => setBgHistory({...bgHistory, surgHx: e.target.value})} />
        </div>
        <div className="input-group">
          <label className="input-label" style={{color: 'var(--color-danger)', fontWeight: 'bold'}}>Drug Allergy (CRITICAL)</label>
          <input className="input-field" style={{borderColor: 'var(--color-danger)', borderWidth: '2px', backgroundColor: '#fff3f3'}} placeholder="e.g. Penicillin, Sulfa" value={bgHistory.allergies} onChange={(e) => setBgHistory({...bgHistory, allergies: e.target.value})} />
        </div>
        <div className="input-group">
          <label className="input-label">Current Medications</label>
          <input className="input-field" placeholder="e.g. Metformin, Lisinopril" value={bgHistory.meds} onChange={(e) => setBgHistory({...bgHistory, meds: e.target.value})} />
        </div>
        <div className="input-group">
          <label className="input-label">Habits</label>
          <Selector options={habitOptions} selected={bgHistory.habits} onChange={toggleHabit} />
        </div>
      </Card>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-primary)', alignSelf: 'center', whiteSpace: 'nowrap' }}>⚡ Quick Templates:</span>
        <button onClick={() => applyTemplate('Chest Pain')} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '16px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>❤️ Chest Pain</button>
        <button onClick={() => applyTemplate('Fever')} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '16px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>🤒 Fever</button>
        <button onClick={() => applyTemplate('Breathlessness')} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '16px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>🫁 Breathlessness</button>
        <button onClick={() => applyTemplate('Syncope')} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '16px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>💫 Syncope</button>
      </div>

      <Card title="Chief Complaint">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          {hasVoiceSupport ? (
            <button onClick={handleVoiceInput} style={{ padding: '10px 20px', border: 'none', borderRadius: 24, background: isListening ? '#ffebee' : 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, color: isListening ? '#c62828' : '#fff', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(13,71,161,0.2)', transition: 'all 0.2s' }}>
               🎤 {isListening ? 'Listening Engine Active...' : 'Dictate Complaint (Voice)'}
            </button>
          ) : (
            <div style={{ fontSize: '13px', color: '#f57c00', fontStyle: 'italic', fontWeight: 500, padding: '8px 16px', backgroundColor: '#fff3e0', borderRadius: '16px', border: '1px solid #ffe0b2' }}>
              🎤 Voice input not supported on this device
            </div>
          )}
        </div>
        {voicePreview && (
          <div style={{ padding: '16px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '8px', marginBottom: '16px' }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 500, color: '#1565c0' }}>Recognized: "{voicePreview}"</p>
            <div style={{ display: 'flex', gap: '8px' }}>
               <Button onClick={confirmVoice} style={{ padding: '8px 16px', fontSize: '13px' }}>Confirm Input</Button>
               <Button onClick={() => setVoicePreview(null)} variant="secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>Retry / Discard</Button>
            </div>
          </div>
        )}
        <Selector 
          options={complaintOptions} 
          selected={complaint} 
          onChange={toggleComplaint} 
        />
        {templateUsed && (
           <div style={{ marginTop: '16px', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-primary)', backgroundColor: 'var(--color-background)', display: 'inline-block', padding: '6px 12px', borderRadius: '16px' }}>
             ⚡ Template Used: {templateUsed}
           </div>
        )}
      </Card>

      <Card title="Minimal Vitals">
        {placeholderVitals && !vitalsTouched && (
           <div style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '13px', marginBottom: '16px', backgroundColor: '#ffebee', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #d32f2f' }}>
             ⚠️ Placeholder values automatically loaded — heavily verify against sensors before executing.
           </div>
        )}
        <div className="input-group">
          <label className="input-label">Blood Pressure (mmHg)</label>
          <input 
            className="input-field" 
            placeholder="120/80" 
            value={vitals.bp} 
            onChange={(e) => { setVitals({ ...vitals, bp: e.target.value }); setVitalsTouched(true); }} 
            onKeyDown={(e) => focusNext(e, 'pulseField')}
          />
        </div>
        <div className="input-group">
          <label className="input-label">Pulse (bpm)</label>
          <input 
            id="pulseField"
            className="input-field" 
            type="number" 
            placeholder="85" 
            value={vitals.pulse} 
            onChange={(e) => { setVitals({ ...vitals, pulse: e.target.value }); setVitalsTouched(true); }} 
            onKeyDown={(e) => focusNext(e, 'spo2Field')}
          />
        </div>
        <div className="input-group">
          <label className="input-label">SpO2 (%)</label>
          <input 
            id="spo2Field"
            className="input-field" 
            type="number" 
            placeholder="98" 
            value={vitals.spo2} 
            onChange={(e) => { setVitals({ ...vitals, spo2: e.target.value }); setVitalsTouched(true); }} 
          />
        </div>
      </Card>

      <Card title="ECG Analysis">
        <p style={{marginBottom: 16}}>Select ST Elevation Leads:</p>
        <Selector 
          options={ecgOptions} 
          selected={stLeads} 
          onChange={toggleLead} 
        />
        
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center' }}>
          <input 
            type="checkbox" 
            id="reciprocal" 
            checked={reciprocal} 
            onChange={(e) => setReciprocal(e.target.checked)}
            style={{ width: 24, height: 24, marginRight: 12, accentColor: 'var(--color-primary)' }}
          />
          <label htmlFor="reciprocal" style={{ fontSize: 18, fontWeight: 500 }}>
            Reciprocal Changes Present
          </label>
        </div>
      </Card>

      <div style={{ marginTop: 32, marginBottom: 64, display: 'flex', gap: '16px' }}>
        <Button 
          size="large" 
          onClick={handleSubmit} 
          disabled={!isValid || loading}
          style={{ flex: 1 }}
        >
          {loading ? 'Analyzing Clinical Case...' : 'Analyze Case'}
        </Button>
        <Button size="large" onClick={confirmClearDraft} variant="secondary">
          Clear Draft
        </Button>
      </div>
    </div>
  );
}
