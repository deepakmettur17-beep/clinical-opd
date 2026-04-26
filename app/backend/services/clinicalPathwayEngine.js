/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  CLINICAL PATHWAY ENGINE
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  Evidence-based clinical pathway guide for emergency and ICU cases.
 *  SAFETY: This engine is DECISION SUPPORT ONLY.
 *          Do NOT auto-execute any intervention.
 *
 *  Supported Pathways:
 *    - STEMI          (MONA protocol)
 *    - Sepsis         (Sepsis-3 bundle)
 *    - Stroke         (Time-window & thrombolysis eligibility)
 *    - Respiratory Failure (O2 â†’ NIV â†’ Intubation escalation)
 *    - Shock          (Hemodynamic resuscitation)
 *    - ACS (NSTEMI)   (Risk stratification)
 *    - DKA            (IV fluids, insulin, electrolytes)
 *    - Hypertensive Emergency
 *
 *  INPUT:  { diagnosis, probableFailureType, priorityLevel, vitals }
 *  OUTPUT: { pathwayName, checklist, timeTargets, warnings, evidence }
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

/**
 * Match diagnosis string to a known pathway using keyword logic.
 */
function matchPathway(diagnosis) {
    const d = (diagnosis || '').toLowerCase();

    if (d.includes('stemi') || (d.includes('st elevation') && d.includes('mi'))) return 'STEMI';
    if (d.includes('nstemi') || d.includes('unstable angina') || d.includes('acs')) return 'NSTEMI_ACS';
    if (d.includes('sepsis') || d.includes('septic shock')) return 'SEPSIS';
    if (d.includes('stroke') || d.includes('cva') || d.includes('tia')) return 'STROKE';
    if (
        d.includes('respiratory failure') ||
        d.includes('ards') ||
        d.includes('acute resp') ||
        d.includes('hypoxic') ||
        d.includes('copd exacerbation') ||
        d.includes('ventilation')
    ) return 'RESPIRATORY_FAILURE';
    if (d.includes('cardiogenic shock') || d.includes('shock')) return 'SHOCK';
    if (d.includes('dka') || d.includes('diabetic keto')) return 'DKA';
    if (d.includes('hypertensive emergency') || d.includes('hypertensive crisis')) return 'HYPERTENSIVE_EMERGENCY';

    return null;
}

/**
 * Override/supplement pathway match using failure type from Action Priority Engine.
 */
function matchFromFailureType(probableFailureType) {
    const f = (probableFailureType || '').toLowerCase();
    if (f.includes('hypoxia') || f.includes('oxygen')) return 'RESPIRATORY_FAILURE';
    if (f.includes('ventilation') || f.includes('hypercapnia')) return 'RESPIRATORY_FAILURE';
    if (f.includes('hemodynamic') || f.includes('shock')) return 'SHOCK';
    return null;
}

// â”€â”€â”€ PATHWAY DEFINITIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PATHWAYS = {

    STEMI: {
        pathwayName: 'STEMI â€” MONA Reperfusion Protocol',
        evidence: 'ACC/AHA STEMI Guidelines 2022',
        checklist: [
            { step: 1, task: 'Aspirin 325mg stat (chew, not swallow)', category: 'IMMEDIATE', done: false },
            { step: 2, task: 'Nitroglycerin 0.4mg SL (if SBP > 90 and no Viagra use in 24h)', category: 'IMMEDIATE', done: false },
            { step: 3, task: 'Morphine 2â€“4mg IV for refractory pain (optional, use cautiously)', category: 'IMMEDIATE', done: false },
            { step: 4, task: 'Oxygen: maintain SpO2 > 94% (avoid if SpO2 â‰¥ 94%)', category: 'IMMEDIATE', done: false },
            { step: 5, task: 'Dual antiplatelet: Clopidogrel 600mg OR Ticagrelor 180mg', category: 'IMMEDIATE', done: false },
            { step: 6, task: 'Anticoagulation: Heparin 60U/kg IV bolus (max 4000U)', category: 'IMMEDIATE', done: false },
            { step: 7, task: 'Activate Cath Lab / arrange primary PCI â€” Door-to-Balloon < 90 min', category: 'URGENT', done: false },
            { step: 8, task: 'If PCI not available: Thrombolysis if no contraindications & within 12hr onset', category: 'URGENT', done: false },
            { step: 9, task: 'Continuous ECG monitoring, defibrillator at bedside', category: 'URGENT', done: false },
            { step: 10, task: 'Labs: Troponin, CBC, BMP, coagulation, lipid panel', category: 'SUPPORTIVE', done: false },
        ],
        timeTargets: [
            { label: 'First Medical Contact to ECG', target: '< 10 min', priority: 'CRITICAL' },
            { label: 'Door-to-Balloon (Primary PCI)', target: '< 90 min', priority: 'CRITICAL' },
            { label: 'Door-to-Thrombolytic (if PCI unavailable)', target: '< 30 min', priority: 'HIGH' },
            { label: 'Aspirin Administration', target: 'Immediate (on arrival)', priority: 'CRITICAL' },
        ],
        warnings: [
            'â›” Do NOT give nitroglycerin if RV infarct suspected (inferior STEMI) â€” can cause fatal hypotension',
            'â›” Avoid morphine in ACS â€” associated with worse outcomes in some data',
            'âš ï¸ Verify no active bleeding, stroke history, or recent surgery before thrombolysis',
            'â›” Do NOT delay reperfusion for labs or other workup',
        ],
    },

    NSTEMI_ACS: {
        pathwayName: 'NSTEMI / Unstable Angina â€” Risk-Stratified ACS Protocol',
        evidence: 'ACC/AHA UA/NSTEMI Guidelines 2021',
        checklist: [
            { step: 1, task: 'Aspirin 325mg stat', category: 'IMMEDIATE', done: false },
            { step: 2, task: 'P2Y12 inhibitor: Ticagrelor 180mg or Clopidogrel 300mg loading', category: 'IMMEDIATE', done: false },
            { step: 3, task: 'Risk stratification: GRACE / TIMI score', category: 'IMMEDIATE', done: false },
            { step: 4, task: 'Anticoagulation: LMWH (Enoxaparin 1mg/kg SC) or UFH', category: 'URGENT', done: false },
            { step: 5, task: 'Beta-blocker: Metoprolol 25â€“50mg PO (if no contraindications)', category: 'URGENT', done: false },
            { step: 6, task: 'Statin: Atorvastatin 80mg PO', category: 'URGENT', done: false },
            { step: 7, task: 'Continuous ECG monitoring â€” watch for ST changes', category: 'URGENT', done: false },
            { step: 8, task: 'Serial troponin at 0h, 3h, 6h', category: 'URGENT', done: false },
            { step: 9, task: 'High GRACE score (> 140): Early invasive strategy within 24h', category: 'URGENT', done: false },
            { step: 10, task: 'Echo to assess LV function', category: 'SUPPORTIVE', done: false },
        ],
        timeTargets: [
            { label: 'First ECG', target: '< 10 min', priority: 'CRITICAL' },
            { label: 'Invasive strategy (High risk)', target: '< 24hr', priority: 'HIGH' },
            { label: 'Invasive strategy (Intermediate risk)', target: '< 72hr', priority: 'MODERATE' },
        ],
        warnings: [
            'âš ï¸ High GRACE score (> 140) = high mortality risk â€” do not defer cath',
            'â›” Check for heparin-induced thrombocytopenia (HIT) if prior heparin use',
            'âš ï¸ Avoid GP IIb/IIIa use without cardiology oversight',
        ],
    },

    SEPSIS: {
        pathwayName: 'Sepsis / Septic Shock â€” Surviving Sepsis Bundle',
        evidence: 'Surviving Sepsis Campaign Guidelines 2021 (Hour-1 Bundle)',
        checklist: [
            { step: 1, task: 'Measure lactate â€” if > 2 mmol/L = sepsis-induced hypoperfusion', category: 'IMMEDIATE', done: false },
            { step: 2, task: 'Blood cultures x2 (aerobic + anaerobic) BEFORE antibiotics', category: 'IMMEDIATE', done: false },
            { step: 3, task: 'Broad-spectrum antibiotics within 1 hour of recognition', category: 'IMMEDIATE', done: false },
            { step: 4, task: 'IV crystalloid 30 mL/kg for hypotension or lactate â‰¥ 4 mmol/L', category: 'IMMEDIATE', done: false },
            { step: 5, task: 'Vasopressors (Norepinephrine): start if MAP < 65 after fluids', category: 'URGENT', done: false },
            { step: 6, task: 'Target MAP â‰¥ 65 mmHg', category: 'URGENT', done: false },
            { step: 7, task: 'Source control: identify & address infection source within 6â€“12h', category: 'URGENT', done: false },
            { step: 8, task: 'Reassess fluid responsiveness â€” avoid fluid overload', category: 'URGENT', done: false },
            { step: 9, task: 'Hydrocortisone 200mg/day IV if refractory shock (vasopressor dependent)', category: 'URGENT', done: false },
            { step: 10, task: 'Monitor: hourly urine output, lactate clearance q2h, CBC/BMP', category: 'SUPPORTIVE', done: false },
        ],
        timeTargets: [
            { label: 'Lactate Measurement', target: '< 1 hour', priority: 'CRITICAL' },
            { label: 'Blood Cultures', target: 'Before antibiotics', priority: 'CRITICAL' },
            { label: 'Broad-spectrum Antibiotics', target: '< 1 hour from recognition', priority: 'CRITICAL' },
            { label: 'IV Fluid Resuscitation (30ml/kg)', target: '< 3 hours', priority: 'HIGH' },
            { label: 'Vasopressor Start (if MAP < 65)', target: 'Immediately after/concurrent with fluids', priority: 'HIGH' },
        ],
        warnings: [
            'â›” Do NOT delay antibiotics for cultures â€” but cultures must come FIRST',
            'âš ï¸ Monitor for fluid overload â€” reassess after each 500ml bolus',
            'â›” Septic shock (MAP < 65 despite fluids) = vasopressors mandatory',
            'âš ï¸ Consider MRSA coverage in healthcare-associated or post-op sepsis',
        ],
    },

    STROKE: {
        pathwayName: 'Acute Ischemic Stroke â€” Time-Critical Thrombolysis Protocol',
        evidence: 'AHA/ASA Stroke Guidelines 2023',
        checklist: [
            { step: 1, task: 'Last known well (LKW) time â€” critical for eligibility', category: 'IMMEDIATE', done: false },
            { step: 2, task: 'Non-contrast CT Head STAT â€” rule out hemorrhage', category: 'IMMEDIATE', done: false },
            { step: 3, task: 'NIH Stroke Scale (NIHSS) assessment', category: 'IMMEDIATE', done: false },
            { step: 4, task: 'Blood glucose: correct if < 60 or > 400 mg/dL before tPA', category: 'IMMEDIATE', done: false },
            { step: 5, task: 'IV tPA (Alteplase 0.9 mg/kg, max 90mg) if: < 4.5h onset, no contraindications', category: 'IMMEDIATE', done: false },
            { step: 6, task: 'BP target before tPA: < 185/110 mmHg (use Labetalol or Nicardipine)', category: 'IMMEDIATE', done: false },
            { step: 7, task: 'LVO (Large Vessel Occlusion) check â€” CT angiography', category: 'URGENT', done: false },
            { step: 8, task: 'Mechanical thrombectomy if LVO detected and within 24h (extended window)', category: 'URGENT', done: false },
            { step: 9, task: 'Post-tPA: NO antiplatelets/anticoagulants for 24h', category: 'URGENT', done: false },
            { step: 10, task: 'Aspirin 325mg if not tPA candidate â€” within 24-48h of onset', category: 'SUPPORTIVE', done: false },
            { step: 11, task: 'BP management post-tPA: keep < 180/105 for 24h', category: 'SUPPORTIVE', done: false },
        ],
        timeTargets: [
            { label: 'Door-to-CT (non-contrast)', target: '< 25 min', priority: 'CRITICAL' },
            { label: 'CT Interpretation', target: '< 45 min from arrival', priority: 'CRITICAL' },
            { label: 'Door-to-tPA (if eligible)', target: '< 60 min (target < 45 min)', priority: 'CRITICAL' },
            { label: 'tPA Eligibility Window', target: '< 4.5h from symptom onset', priority: 'CRITICAL' },
            { label: 'Mechanical Thrombectomy Window', target: 'Up to 24h (selected patients)', priority: 'HIGH' },
        ],
        warnings: [
            'â›” Do NOT give tPA if: CT shows hemorrhage, BP > 185/110 uncontrolled, INR > 1.7, platelets < 100k',
            'â›” Do NOT lower BP aggressively in acute stroke â€” cerebral perfusion is pressure-dependent',
            'âš ï¸ Wake-up stroke: if LKW > 4.5h, consider MRI DWI-FLAIR mismatch for extended window',
            'â›” Do NOT give aspirin within 24h of tPA administration',
        ],
    },

    RESPIRATORY_FAILURE: {
        pathwayName: 'Acute Respiratory Failure â€” O2 Escalation Protocol',
        evidence: 'ATS/ERS Mechanical Ventilation Guidelines 2021',
        checklist: [
            { step: 1, task: 'SpO2 â‰¥ 94%: Start nasal cannula 2â€“4 L/min O2', category: 'STEP_1_MILD', done: false },
            { step: 2, task: 'SpO2 90â€“93%: Simple face mask 6â€“10 L/min OR Venturi mask 28â€“40% FiO2', category: 'STEP_2_MODERATE', done: false },
            { step: 3, task: 'SpO2 < 90% or RR > 30: High-Flow Nasal Cannula (HFNC) â€” start 40L flow, 60% FiO2', category: 'STEP_3_SEVERE', done: false },
            { step: 4, task: 'HFNC failure OR PaCO2 rising: Non-Invasive Ventilation (NIV/BiPAP)', category: 'STEP_4_NIV', done: false },
            { step: 5, task: 'NIV failure / declining GCS / refractory hypoxia: Endotracheal Intubation', category: 'STEP_5_INTUBATION', done: false },
            { step: 6, task: 'Treat underlying cause: bronchodilators (COPD), steroids (asthma/ARDS), diuretics (pulmonary edema)', category: 'CAUSE_SPECIFIC', done: false },
            { step: 7, task: 'Lung-protective ventilation if intubated: TV 6 mL/kg IBW, Pplat < 30 cmH2O', category: 'VENTILATOR_SETTINGS', done: false },
            { step: 8, task: 'Prone positioning if P/F ratio < 150 and on MV (ARDS protocol)', category: 'ADVANCED', done: false },
            { step: 9, task: 'Serial ABGs every 2â€“4 hours or after ventilator changes', category: 'MONITORING', done: false },
            { step: 10, task: 'Daily Spontaneous Breathing Trials when FiO2 < 50% and PEEP < 8', category: 'WEANING', done: false },
        ],
        timeTargets: [
            { label: 'O2 Therapy Initiation', target: 'Immediate', priority: 'CRITICAL' },
            { label: 'HFNC Escalation Decision (SpO2 < 90%)', target: '< 15 min', priority: 'CRITICAL' },
            { label: 'Intubation (if HFNC+NIV fails or GCS < 8)', target: 'Immediate', priority: 'CRITICAL' },
            { label: 'ABG After O2 Change', target: '15â€“30 min', priority: 'HIGH' },
            { label: 'SBT Assessment (once stable)', target: 'Daily screening', priority: 'MODERATE' },
        ],
        warnings: [
            'â›” In COPD: avoid high-flow O2 unmonitored â€” can suppress hypoxic drive and worsen CO2 retention',
            'âš ï¸ NIV requires alert, cooperative patient â€” contraindicated if airway not protected',
            'â›” Do NOT delay intubation if: GCS < 8, pH < 7.2 despite NIV, hemodynamic instability',
            'âš ï¸ ARDS: strict fluid restriction after initial resus, lung-protective ventilation mandatory',
        ],
    },

    SHOCK: {
        pathwayName: 'Hemodynamic Shock â€” Resuscitation Protocol',
        evidence: 'ACCM/SCCM Shock Guidelines 2022',
        checklist: [
            { step: 1, task: 'Identify shock type: Distributive / Cardiogenic / Obstructive / Hypovolemic', category: 'IMMEDIATE', done: false },
            { step: 2, task: 'IV access x2 large bore â€” draw labs simultaneously (lactate, CBC, BMP, blood cultures)', category: 'IMMEDIATE', done: false },
            { step: 3, task: 'Crystalloid bolus 500 mL IV over 15 min â€” reassess after each', category: 'IMMEDIATE', done: false },
            { step: 4, task: 'Vasopressors: Norepinephrine 0.01â€“3 mcg/kg/min (first-line for distributive)', category: 'URGENT', done: false },
            { step: 5, task: 'Target: MAP â‰¥ 65 mmHg, UO â‰¥ 0.5 mL/kg/hr, lactate clearance > 10%/2h', category: 'URGENT', done: false },
            { step: 6, task: '12-lead ECG â€” rule out STEMI (cardiogenic shock)', category: 'URGENT', done: false },
            { step: 7, task: 'Echo to assess LV function / pericardial effusion (obstructive)', category: 'URGENT', done: false },
            { step: 8, task: 'Foley catheter â€” hourly urine output monitoring mandatory', category: 'URGENT', done: false },
            { step: 9, task: 'Cardiogenic shock: do NOT fluid load â€” early dobutamine/inotrope consideration', category: 'CARDIOGENIC', done: false },
            { step: 10, task: 'Obstructive shock (PE/tamponade): targeted therapy (thrombolysis / pericardiocentesis)', category: 'OBSTRUCTIVE', done: false },
        ],
        timeTargets: [
            { label: 'IV Access + Labs', target: 'Immediate', priority: 'CRITICAL' },
            { label: 'First Fluid Bolus', target: '< 15 min', priority: 'CRITICAL' },
            { label: 'Vasopressor Start (if MAP < 65)', target: 'Concurrent with fluids', priority: 'CRITICAL' },
            { label: 'Lactate Clearance Assessment', target: 'Every 2 hours', priority: 'HIGH' },
        ],
        warnings: [
            'â›” Do NOT give large fluid bolus in cardiogenic shock â€” worsens pulmonary edema',
            'âš ï¸ Suspect tension pneumothorax if tracheal deviation + absent breath sounds + shock â€” immediate needle decompression',
            'â›” Vasopressors are a bridge â€” source control/definitive treatment must be pursued in parallel',
            'âš ï¸ Monitor for abdominal compartment syndrome in massive fluid resuscitation',
        ],
    },

    DKA: {
        pathwayName: 'Diabetic Ketoacidosis (DKA) â€” Metabolic Resuscitation Protocol',
        evidence: 'ADA DKA Management Guidelines 2023',
        checklist: [
            { step: 1, task: 'IV fluid: Normal Saline 1L over 1h (aggressive rehydration)', category: 'IMMEDIATE', done: false },
            { step: 2, task: 'Check K+ BEFORE insulin â€” if K+ < 3.5, replace first; do NOT start insulin', category: 'IMMEDIATE', done: false },
            { step: 3, task: 'Regular insulin 0.1 U/kg/hr IV infusion (NOT subcutaneous)', category: 'URGENT', done: false },
            { step: 4, task: 'Add Dextrose 5% when glucose < 200 mg/dL to prevent hypoglycemia', category: 'URGENT', done: false },
            { step: 5, task: 'Potassium replacement: target K+ 3.5â€“5.0 mEq/L throughout', category: 'URGENT', done: false },
            { step: 6, task: 'Identify and treat precipitating cause (infection, missed insulin, etc.)', category: 'URGENT', done: false },
            { step: 7, task: 'Resolution targets: anion gap < 12, bicarb > 18, pH > 7.3', category: 'MONITORING', done: false },
            { step: 8, task: 'Hourly glucose checks, ABG/BMP every 2â€“4 hours', category: 'MONITORING', done: false },
            { step: 9, task: 'Switch to subcutaneous insulin 2h BEFORE stopping IV insulin drip', category: 'RESOLUTION', done: false },
        ],
        timeTargets: [
            { label: 'IV Fluid Bolus', target: 'Immediate', priority: 'CRITICAL' },
            { label: 'Potassium Check', target: 'Before insulin', priority: 'CRITICAL' },
            { label: 'Insulin Infusion Start', target: '< 1 hour from diagnosis', priority: 'HIGH' },
            { label: 'DKA Resolution', target: '12â€“24 hours', priority: 'MODERATE' },
        ],
        warnings: [
            'â›” Never start insulin before checking potassium â€” fatal hypokalemia can result',
            'âš ï¸ Avoid bicarbonate administration unless pH < 6.9 â€” not routinely recommended',
            'â›” Do NOT stop IV insulin until oral intake is established and first SQ dose given',
        ],
    },

    HYPERTENSIVE_EMERGENCY: {
        pathwayName: 'Hypertensive Emergency â€” Controlled BP Reduction Protocol',
        evidence: 'ACC/AHA Hypertension Guidelines 2022',
        checklist: [
            { step: 1, task: 'Confirm hypertensive EMERGENCY (end-organ damage) vs urgency (no damage)', category: 'IMMEDIATE', done: false },
            { step: 2, task: 'IV agent: Nicardipine 5 mg/hr IV infusion (first-line, titratable)', category: 'IMMEDIATE', done: false },
            { step: 3, task: 'Alternative: Labetalol 20mg IV bolus, then 2mg/min infusion', category: 'IMMEDIATE', done: false },
            { step: 4, task: 'Target: Reduce MAP by NO MORE than 25% in first hour', category: 'IMMEDIATE', done: false },
            { step: 5, task: 'CT Head stat if neurologic symptoms (rule out hemorrhagic stroke)', category: 'URGENT', done: false },
            { step: 6, task: 'Aortic dissection: target systolic < 120 â€” use Esmolol + Nicardipine', category: 'URGENT', done: false },
            { step: 7, task: 'Identify end-organ damage: troponin, BMP, urinalysis, fundoscopy', category: 'SUPPORTIVE', done: false },
            { step: 8, task: 'Transition to oral antihypertensives once stabilized', category: 'RESOLUTION', done: false },
        ],
        timeTargets: [
            { label: 'IV Antihypertensive Start', target: '< 1 hour', priority: 'CRITICAL' },
            { label: '25% MAP Reduction', target: 'Within first hour', priority: 'CRITICAL' },
            { label: 'Further Reduction to 160/100', target: '2â€“6 hours', priority: 'HIGH' },
            { label: 'Normalization', target: '24â€“48 hours', priority: 'MODERATE' },
        ],
        warnings: [
            'â›” Do NOT drop BP too rapidly â€” can cause watershed infarction (brain, heart, kidney)',
            'â›” Avoid sublingual nifedipine â€” unpredictable drop, no longer recommended',
            'âš ï¸ Aortic dissection requires most aggressive reduction (target SBP < 120)',
            'âš ï¸ In ischemic stroke: permissive hypertension up to 220/120 (unless tPA planned)',
        ],
    },
};

// â”€â”€â”€ DEFAULT FALLBACK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DEFAULT_PATHWAY = {
    pathwayName: 'General Critical Care â€” Monitoring & Support Protocol',
    evidence: 'SCCM Critical Care Guidelines',
    checklist: [
        { step: 1, task: 'Secure IV access, draw full blood panel', category: 'IMMEDIATE', done: false },
        { step: 2, task: 'Continuous SpO2, ECG, and non-invasive BP monitoring', category: 'IMMEDIATE', done: false },
        { step: 3, task: 'Airway assessment â€” ensure patency', category: 'IMMEDIATE', done: false },
        { step: 4, task: 'Identify primary diagnosis and consult appropriate specialist', category: 'URGENT', done: false },
        { step: 5, task: 'Supportive care as per clinical status', category: 'SUPPORTIVE', done: false },
    ],
    timeTargets: [
        { label: 'Initial Assessment', target: 'Immediate', priority: 'CRITICAL' },
        { label: 'Specialist Consult', target: '< 1 hour', priority: 'HIGH' },
    ],
    warnings: [
        'âš ï¸ No specific pathway matched â€” verify diagnosis and clinical context',
    ],
};

// â”€â”€â”€ SUPPLEMENT WITH VITALS-BASED WARNINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function appendVitalWarnings(pathway, vitals) {
    const spo2 = parseFloat(vitals?.spo2) || 0;
    const rr   = parseFloat(vitals?.rr)   || 0;
    const hr   = parseFloat(vitals?.hr)   || 0;
    const ph   = parseFloat(vitals?.abg?.ph) || 0;
    const pco2 = parseFloat(vitals?.abg?.pco2) || 0;
    const sbp  = parseFloat(vitals?.sbp) || 0;

    const extraWarnings = [];

    if (spo2 > 0 && spo2 < 88) extraWarnings.push(`ðŸ”´ CRITICAL: SpO2 ${spo2}% â€” immediate O2 escalation required`);
    if (rr > 30) extraWarnings.push(`ðŸ”´ CRITICAL: RR ${rr}/min â€” respiratory fatigue imminent`);
    if (ph > 0 && ph < 7.2) extraWarnings.push(`ðŸ”´ CRITICAL: pH ${ph} â€” severe acidosis, consider emergent intervention`);
    if (pco2 > 60) extraWarnings.push(`ðŸ”´ CRITICAL: PaCO2 ${pco2} â€” impending ventilatory failure`);
    if (sbp > 0 && sbp < 80) extraWarnings.push(`ðŸ”´ CRITICAL: SBP ${sbp} mmHg â€” shock state, vasopressors needed`);
    if (hr > 140) extraWarnings.push(`âš ï¸ Tachycardia HR ${hr} bpm â€” check hemodynamic impact`);

    return {
        ...pathway,
        checklist: pathway.checklist.map(item => ({ ...item })),  // deep clone
        warnings: [...extraWarnings, ...pathway.warnings],
    };
}

// â”€â”€â”€ MAIN ENGINE FUNCTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function runClinicalPathwayEngine({ diagnosis, probableFailureType, priorityLevel, vitals }) {
    // 1. Try to match by diagnosis
    let pathwayKey = matchPathway(diagnosis);

    // 2. Fallback: match by failure type from the Action Priority Engine
    if (!pathwayKey) {
        pathwayKey = matchFromFailureType(probableFailureType);
    }

    // 3. Get base pathway (or default)
    const basePathway = pathwayKey ? PATHWAYS[pathwayKey] : DEFAULT_PATHWAY;

    // 4. Append vitals-based real-time warnings
    const finalPathway = appendVitalWarnings(basePathway, vitals);

    return {
        pathwayKey: pathwayKey || 'GENERAL',
        pathwayName: finalPathway.pathwayName,
        checklist: finalPathway.checklist,
        timeTargets: finalPathway.timeTargets,
        warnings: finalPathway.warnings,
        evidence: finalPathway.evidence || 'Evidence-based medicine guidelines',
        safetyNote: 'DECISION SUPPORT ONLY â€” Do NOT auto-execute. Clinical judgment and physician authority required.',
    };
}

module.exports = { runClinicalPathwayEngine };