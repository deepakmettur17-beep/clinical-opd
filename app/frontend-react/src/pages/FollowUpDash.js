import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchPatients, getFollowUpAnalysis, createVisit, getPharmacyStock } from "../services/API";

function FollowUpDash() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [currentMeds, setCurrentMeds] = useState([
    { name: "Metformin", dose: "500 mg", frequency: "BD", action: "Continue" },
    { name: "Glimepiride", dose: "1 mg", frequency: "OD", action: "Continue" }
  ]);
  const [loading, setLoading] = useState(true);
  const [stockInfo, setStockInfo] = useState({});
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    loadData();
  }, [patientId]);

  const loadData = async () => {
    try {
      const pRes = await fetchPatients();
      const p = pRes.data.find(x => x._id === patientId);
      setPatient(p);

      const aRes = await getFollowUpAnalysis(patientId);
      setAnalysis(aRes.data);
      
      // Fetch initial stock for current meds
      const stockMap = {};
      for (const med of currentMeds) {
        const sRes = await getPharmacyStock(med.name);
        stockMap[med.name] = sRes.data;
      }
      setStockInfo(stockMap);
      
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleMedAction = (index, action) => {
    const newMeds = [...currentMeds];
    newMeds[index].action = action;
    setCurrentMeds(newMeds);
  };

  const handleSearch = async (e) => {
    setSearchTerm(e.target.value);
    if (e.target.value.length > 2) {
      const res = await getPharmacyStock(e.target.value);
      setSearchResults(res.data);
    } else {
      setSearchResults([]);
    }
  };

  const addMed = (brandObj) => {
    setCurrentMeds([...currentMeds, { 
      name: brandObj.brand, 
      dose: brandObj.strength, 
      frequency: "OD", 
      action: "New" 
    }]);
    setShowSearch(false);
    setSearchTerm("");
    setSearchResults([]);
  };

  const generateNote = () => {
    if (!analysis || !patient) return "No data available";
    const medSummary = currentMeds
      .filter(m => m.action !== "Continue")
      .map(m => `${m.action} ${m.name}`)
      .join(", ") || "Maintain current therapy";
    
    return `Patient ${patient.firstName} with chronic conditions. 
HbA1c Trend: ${analysis.trends.summary.hba1cStatus}. 
BP Trend: ${analysis.trends.summary.bpStatus}. 
Medication Adjustment: ${medSummary}. 
Advised follow-up in 2 weeks.`;
  };

  const handleFinalize = async () => {
    try {
       await createVisit({
           patientId,
           complaint: "Follow-up",
           diagnosis: "Chronic Disease Management",
           notes: generateNote(),
           finalized: true
       });
       alert("Follow-up visit finalized!");
       navigate("/patients");
    } catch (err) {
       console.error(err);
    }
  };

  if (loading) return <div className="loading">Loading Follow-Up Intelligence...</div>;

  return (
    <div className="follow-up-page">
      <header className="page-header">
        <h2>Follow-Up: {patient?.firstName} {patient?.lastName}</h2>
        <span className="last-visit">Last Visit: {analysis?.trends.lastVisit ? new Date(analysis.trends.lastVisit).toLocaleDateString() : 'Never'}</span>
      </header>

      <div className="dashboard-grid">
        {/* 1. SNAPSHOT & AUTO-SUGGESTION */}
        <section className="column">
          <div className="card snapshot-card">
            <h3>Clinical Trend Snapshot</h3>
            <div className="trend-container">
              <div className="trend-item">
                <label>HbA1c Trend</label>
                <div className="trend-values">{analysis?.trends.history.hba1c.map(h => h.val).join(" â†’ ")}</div>
                <span className={`badge ${analysis?.trends.summary.hba1cStatus.includes('âš ï¸') ? 'danger' : 'success'}`}>
                  {analysis?.trends.summary.hba1cStatus}
                </span>
              </div>
              <div className="trend-item">
                <label>BP (SBP) Trend</label>
                <div className="trend-values">{analysis?.trends.history.sbp.map(s => s.val).join(" â†’ ")}</div>
                <span className={`badge ${analysis?.trends.summary.bpStatus.includes('âš ï¸') ? 'danger' : 'success'}`}>
                  {analysis?.trends.summary.bpStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="card insights-card">
            <h3>Consultant Suggestions</h3>
            {analysis?.suggestions.length > 0 ? (
                analysis.suggestions.map((s, i) => (
                    <div key={i} className="suggestion-pill">
                        <strong>{s.condition}</strong>: {s.reason} âž¡ï¸ <span className="highlight">{s.action}</span>
                    </div>
                ))
            ) : (
                <p>No immediate changes suggested. Maintain therapy.</p>
            )}
          </div>
        </section>

        {/* 2. MEDICATION ACTION PANEL */}
        <section className="column">
          <div className="card meds-card">
            <h3>One-Click Medication Adjustment</h3>
            <div className="meds-list">
              {currentMeds.map((m, i) => {
                const availableBrands = stockInfo[m.name] || [];
                const currentStock = availableBrands.find(b => b.brand === m.name)?.stockCount || 0;
                
                return (
                  <div key={i} className={`med-row ${m.action.toLowerCase()}`}>
                    <div className="med-meta">
                      <strong>{m.name}</strong>
                      <span>{m.dose} â€” {m.frequency}</span>
                      <div className={`stock-badge ${currentStock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                        {currentStock > 0 ? `${currentStock} in stock` : 'OUT OF STOCK'}
                      </div>
                    </div>
                    {currentStock === 0 && availableBrands.length > 1 && (
                      <div className="stock-suggestion">
                        Suggest: {availableBrands.find(b => b.stockCount > 0)?.brand}
                      </div>
                    )}
                    <div className="btn-group">
                      <button onClick={() => handleMedAction(i, "Increase")} className={m.action === "Increase" ? "active" : ""}>+ Increase</button>
                      <button onClick={() => handleMedAction(i, "Reduce")} className={m.action === "Reduce" ? "active" : ""}>- Reduce</button>
                      <button onClick={() => handleMedAction(i, "Continue")} className={m.action === "Continue" ? "active" : ""}>Continue</button>
                      <button onClick={() => handleMedAction(i, "Stop")} className={m.action === "Stop" ? "active" : ""}>Stop</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {showSearch ? (
              <div className="add-med-search">
                <input 
                  type="text" 
                  placeholder="Search Generic or Brand..." 
                  value={searchTerm} 
                  onChange={handleSearch}
                  autoFocus
                />
                <div className="search-results">
                  {searchResults.map((r, idx) => (
                    <div key={idx} className="search-item" onClick={() => addMed(r)}>
                      {r.brand} ({r.genericName} - {r.strength}) - Stock: {r.stockCount}
                    </div>
                  ))}
                </div>
                <button className="btn-cancel" onClick={() => setShowSearch(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn-add-med" onClick={() => setShowSearch(true)}>+ Add New Medication</button>
            )}
          </div>

          <div className="card note-card">
            <h3>Auto-Generated Clinical Note</h3>
            <textarea readOnly value={generateNote()} className="note-area" />
            <button className="btn-finalize" onClick={handleFinalize}>Finalize Visit & Print Prescription</button>
          </div>
        </section>
      </div>

      {/* COMPLIANCE ALERT */}
      {patient?.complianceMeta?.missedVisits > 0 && (
         <div className="adherence-alert">
            âš ï¸ <strong>Adherence Risk:</strong> Patient missed {patient.complianceMeta.missedVisits} scheduled visits. Verify drug compliance carefully.
         </div>
      )}
    </div>
  );
}

export default FollowUpDash;

