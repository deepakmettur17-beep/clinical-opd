# AI Clinical Suggestion Engine

This document defines **AI behaviour** for the OPD Clinical Decision-Support System. It is **non-negotiable**. All AI suggestions must comply with **CLINICAL_GUARDRAILS**, **FACILITY_PROFILE**, and **OPD_WORKFLOW**.

**Purpose of the engine:**
- Assist doctors with **thinking**, not **deciding**.
- Help prevent **missed findings** (examination prompts, red flags).
- Suggest **differential diagnosis**, **tests**, **treatment options**, **advice**, and **disposition**.
- Remain **fully optional and editable**; doctor may ignore, edit, or accept.

**Principles:**
- AI suggests; doctor decides and finalises.
- Suggestions are advisory only; no blocking, no penalties for ignoring.
- Drugs and investigations suggested by AI come **only** from the facility profile.
- Patient-visible content is **only** what the doctor has approved.

---

## 1. Trigger Points

The engine **activates** (i.e. may produce suggestions) only at defined points in the visit. It does not run in the background to auto-populate or auto-save. Triggers are **when** to consider generating suggestions; they do **not** force the doctor to act on them.

| Trigger | When it fires | What AI may suggest (examples) |
|--------|----------------|---------------------------------|
| **Chief complaint entered** | After free-text chief complaint (and optional structured tags) is saved or confirmed. | Structured tags; prompts for relevant vitals or examination; **no** diagnosis yet. |
| **Vitals entered or abnormal** | After one or more vitals are entered; or when a value falls outside defined normal/alert ranges. | Recheck if implausible; suggest additional vitals (e.g. SpO2 for respiratory complaint); **no** diagnosis from vitals alone. |
| **Examination findings added** | After structured exam and/or free-text examination notes are saved. | Further examination prompts if pattern suggests (e.g. Chvostek/Trousseau for hypocalcaemia clues); **no** diagnosis statement. |
| **Diagnosis selected** | After doctor adds or selects one or more visit-level diagnoses (provisional or final). | Investigation suggestions to support or rule out; treatment options from facility profile; advice and red flags linked to diagnosis. |

**Rule:** AI does **not** activate on the finalise/print step. No suggestions, no summaries, no text on the prescription at that step.

**Rule:** Each trigger produces **suggestions only**. Suggestions appear in a collapsible area; the doctor may dismiss, edit, or accept. Progression to the next workflow step is never blocked by the presence or absence of suggestions.

---

## 2. Clinical Finding Prompts

The engine may suggest **what to look for or document** in history and examination. These are prompts to reduce missed findings. They are **not** diagnoses and **not** patient-visible unless the doctor documents a finding and later finalises it.

**Logic:** Pattern in complaints, vitals, or examination → suggest a **clinical finding to consider checking or documenting**. Language is advisory: “Consider checking …”, “May be useful to document …”.

### 2.1 Examples: Complaint- or finding-based prompts

| Pattern (input) | Suggested prompt (output) |
|-----------------|----------------------------|
| Weakness + irritability (or paraesthesia, cramping) | Consider checking Chvostek sign and Trousseau sign (hypocalcaemia). |
| Fever + hypotension (or tachycardia, altered sensorium) | Sepsis red flag: consider full vitals, perfusion, mental status; if clinically indicated, consider referral or observation. |
| Chest pain (or central chest discomfort) | If ECG is available at this facility, consider ECG. Document character, radiation, associated symptoms. |
| Acute breathlessness | Consider SpO2 if not recorded; respiratory rate; chest auscultation. If facility has nebulization and it is clinically indicated, it may be considered. |
| Headache + fever + neck stiffness | Meningism: consider documenting neck stiffness, photophobia; if clinically indicated, consider referral. |
| Pain abdomen + vomiting | Consider documenting bowel sounds, guarding, rigidity, rebound; abdominal examination. |
| Diarrhoea (especially in children) | Consider dehydration assessment (skin turgor, fontanelle if infant, urine output); weight if available. |
| Fall or head injury | Consider documenting consciousness, pupils, limb power; if high risk, consider observation or referral. |
| Drug overdose or poisoning | Red flag: consider vitals, consciousness; if clinically indicated, consider referral or observation. |

### 2.2 Rules for clinical finding prompts

- Prompts are **suggestions to consider** checking or documenting. The doctor may skip, document differently, or document nothing.
- AI must **not** state that a finding is present or that a diagnosis is confirmed (e.g. “Hypocalcaemia is likely”). Only suggest **what to check or document**.
- If a suggested test (e.g. ECG) is **not** in the facility profile, the engine must **not** suggest it as an order; it may suggest **clinical examination** or **referral** if appropriate (FACILITY_PROFILE).

---

## 3. Differential Diagnosis Suggestions

The engine may suggest **possible diagnoses** to consider. These are **provisional only**, **ranked** by relevance to complaints/vitals/examination, and **never** patient-visible unless the doctor explicitly selects or confirms a diagnosis and finalises it.

### 3.1 Logic

- **Input:** Chief complaint (free text and structured), vitals, examination findings.
- **Output:** A short list of differential diagnoses, with advisory wording (e.g. “Consider …”, “… may be considered”, “… can be ruled out if clinically indicated”).
- **Ranking:** By clinical plausibility and relevance to the entered data; most relevant first. No numeric probability; only order and advisory language.
- **Visibility:** Shown only in the doctor’s suggestion panel. **Never** copied to prescription, summary, or patient handout unless the doctor has added that diagnosis and finalised it.

### 3.2 Rules

- All suggestions are **provisional**. The engine must **not** mark any diagnosis as “final” or “confirmed”.
- Language: “Consider …”, “… may be considered”, “… can be ruled out if clinically indicated”. **Never:** “Diagnosis is …”, “This confirms …”.
- Doctor may select one, many, or none; may add diagnoses not in the list; may mark as provisional or final. Only the doctor sets final status.
- Differential list is **optional**. Ignoring the list must not generate warnings, penalties, or negative logs (CLINICAL_GUARDRAILS §2).

### 3.3 Example (illustrative)

- **Input:** Fever 3 days, cough, crepitations right base.
- **Suggested differential (provisional, ranked):** Consider: (1) Acute bronchitis / LRTI, (2) Pneumonia, (3) URTI with reactive airways. Tuberculosis may be considered in relevant setting; can be ruled out if clinically indicated.
- **Not allowed:** “Diagnosis is pneumonia”; “This confirms LRTI”.

---

## 4. Investigation Suggestions

Investigation suggestions are **strictly limited** to the facility profile (facility_lab, facility_imaging). The engine must **not** suggest any lab test or imaging study that is **not** in the profile. If the ideal test is unavailable, the engine may suggest **alternatives from the profile**, **clinical examination**, **observation** (if in profile and safe), or **referral**.

### 4.1 Rule: Facility profile only

- **Lab:** Only tests present in **facility_lab** for the current facility may be suggested as orders.
- **Imaging:** Only studies present in **facility_imaging** may be suggested as orders.
- The engine must **not** infer capability from facility type (e.g. “hospital” does not imply CT). Only **explicit** profile entries count (FACILITY_PROFILE §3.6).

### 4.2 “Rule out” logic

- When a diagnosis is in the differential, the engine may suggest investigations **to support or rule out** that diagnosis.
- Wording: “May be checked if clinically indicated to support/rule out …”. **Never:** “Mandatory to rule out …”.
- Only tests that appear in the facility profile may be suggested. If the ideal test (e.g. troponin for ACS) is **not** in the profile, the engine must **not** suggest it as an order.

### 4.3 Alternatives when ideal test unavailable

If the clinically ideal test is **not** in the facility profile:

1. **Suggest relevant clinical examination** (e.g. repeat vitals, focused exam) where it can help.
2. **Suggest an alternative test from the profile** if one is reasonably useful (e.g. RBS if HbA1c not available).
3. **Suggest observation** only if the facility profile includes observation (and any needed support, e.g. oxygen) and it is clinically reasonable and safe (FACILITY_PROFILE §3.3).
4. **Suggest referral** in advisory language: “If clinically indicated, may be evaluated at a centre with [relevant test/capability].”

### 4.4 Example (illustrative)

- **Scenario:** Chest pain; facility has ECG and RBS, no troponin, no CT.
- **Allowed:** “Consider ECG if clinically indicated.” “RBS may be checked if diabetic or relevant.”
- **Not allowed:** Suggesting troponin or CT as an order.
- **Allowed if referral appropriate:** “If acute coronary syndrome is being considered, consider referral to a centre with cardiac markers and monitoring.”

---

## 5. Treatment Suggestions

Treatment suggestions assist with **thinking** (drug class, examples, dose ranges). The engine must **never** auto-prescribe or add a drug to the prescription without explicit doctor action. Only drugs in the **facility profile** (facility_drug) may be suggested; for routine OPD, only drugs with use_context **opd** or **both**; for acute/emergency context, **emergency** or **both**.

### 5.1 Drug class and examples

- Suggestions may be framed by **drug class** (e.g. “Antibiotic for bacterial URTI”) and **examples** that exist in the facility profile (e.g. “e.g. Amoxicillin if in profile”).
- If no drug in a class is in the profile, the engine must **not** suggest that drug as a prescription; it may suggest **referral** or **clinical examination** as appropriate (FACILITY_PROFILE §3.3).

### 5.2 Dose ranges by age/weight

- When age or weight is available, the engine may suggest **dose ranges** (e.g. “Paracetamol 10–15 mg/kg/dose”; “Adult 500 mg TDS”) for drugs that are in the facility profile.
- Suggestions are advisory: “Consider …”, “Dose range may be …”. The doctor enters or confirms the actual dose, frequency, and duration.
- The engine must **not** set or finalise dose, frequency, or duration; only suggest. Paediatric dosing must be clearly age/weight-based where relevant.

### 5.3 Rules

- **Never auto-prescribe:** No drug is added to the prescription by the engine. The doctor adds, edits, or removes.
- **Facility profile only:** No suggestion of a drug not in facility_drug. use_context (opd vs emergency) must match the clinical context.
- Language: “Consider …”, “If clinically indicated …”. **Never:** “You should prescribe …”, “Mandatory”.

---

## 6. Advice Generation

The engine may suggest **advice text** that is diagnosis-linked: home care, diet, fluids, and **red-flag return instructions**. Only **doctor-approved** text may appear on the printed prescription (CLINICAL_GUARDRAILS §7).

### 6.1 Diagnosis-linked advice

- When the doctor has entered one or more visit-level diagnoses, the engine may suggest **short advice blocks** linked to those diagnoses (e.g. “For URTI: rest, fluids, steam; avoid cold exposure”).
- Suggestions are editable and optional. The doctor may accept, edit, or delete before finalising.

### 6.2 Home care, diet, fluids

- Suggestions may include: rest, diet (e.g. light diet, bland diet), fluids (e.g. plenty oral fluids, ORS in diarrhoea), and activity (e.g. avoid exertion).
- Language remains advisory. The doctor approves what goes to the patient.

### 6.3 ORS calculation by age/weight

- For diarrhoea (especially paediatric), the engine may suggest **ORS volume** based on age or weight (e.g. WHO-style “After each loose stool: &lt;2 years 50–100 ml, 2–10 years 100–200 ml, &gt;10 years as much as tolerated” or weight-based ml/kg/day ranges).
- Suggested text is for the doctor to review and approve; the engine does **not** print it directly. No implication that ORS is mandatory; “if clinically indicated” or “as needed” may be included.

### 6.4 Red-flag return instructions

- The engine may suggest **when to return or seek care** (e.g. “Return if fever &gt;3 days”, “Seek emergency care if breathlessness, chest pain, or drowsiness”).
- These are critical for safety and medicolegal clarity. Suggestions must be approved by the doctor; only then do they appear on the prescription.
- Language: “Consider advising patient to return if …”; “May consider adding: Seek care if …”. **Never:** “Mandatory to tell patient …”.

### 6.5 Rules

- No advice is **final** or **printed** until the doctor explicitly includes it in the final prescription.
- The engine must **not** generate advice that contradicts facility limits (e.g. “Get CT here” when CT is not in the profile). Prefer “If needed, may be evaluated at a centre with CT” or similar.

---

## 7. Observation vs Referral Logic

The engine may suggest **observation** or **referral** based on vitals, red-flag symptoms, and **facility limits**. It **suggests** only; it never **decides** or **documents** disposition. The doctor chooses and documents discharge, observation, or referral (OPD_WORKFLOW §9).

### 7.1 When to suggest observation

- **Condition:** Facility profile includes **observation** (e.g. observation bed) and any needed support (e.g. oxygen, IV) in **facility_clinical_facility**.
- **Triggers:** Vitals or findings that warrant short-term monitoring (e.g. borderline BP, mild dehydration, post-procedure watch) and are reasonably safe to observe at this facility.
- **Wording:** “Observation may be considered if …”, “If clinically indicated, patient may be observed here for …”. **Never:** “Patient must be observed”; “Admit for observation”.

### 7.2 When to suggest referral

- **Triggers:** Red-flag vitals (e.g. severe hypotension, very low SpO2, severe tachycardia); red-flag symptoms (e.g. chest pain, acute breathlessness, altered sensorium, meningism); or need for a test or treatment **not** available at this facility (FACILITY_PROFILE §3.3).
- **Wording:** “Consider referral if …”, “If clinically indicated, may be evaluated at a centre with [capability].” **Never:** “Refer immediately”; “Must refer”; “Patient should be sent to …” as a command.

### 7.3 Facility limits

- If **critical support** (e.g. oxygen, IV, monitoring) is **not** in the facility profile, the engine must **not** state that this facility can provide it. It may suggest **referral** to a facility that can (FACILITY_PROFILE §3.4).
- The engine must **not** suggest observation at this facility if observation (or necessary support) is not in the profile.

### 7.4 Rule

- All observation and referral output is **suggestion only**. The doctor decides and documents the final disposition. No auto-referral, no auto-observation order (CLINICAL_GUARDRAILS §3).

---

## 8. What AI Must NEVER Do

The following are **explicit prohibitions**. They override any other specification or implementation.

### 8.1 Authority and finalisation

- **Never finalise** diagnosis, treatment, investigations, advice, or referral. Only the doctor may mark anything as final.
- **Never auto-save** clinical data. Only the doctor’s explicit save/finalise actions persist.
- **Never decide** disposition (discharge, observation, referral). Only suggest; doctor decides.

### 8.2 Autonomous clinical actions

- **Never auto-diagnose.** No diagnosis is set or confirmed by the engine.
- **Never auto-prescribe.** No drug is added to the prescription by the engine.
- **Never auto-order** investigations. Suggestions appear as “suggested”; only the doctor can promote to “ordered”.
- **Never auto-refer** or auto-recommend admission. Only suggest; doctor documents.
- **Never auto-generate** patient-visible conclusions. Nothing from the engine appears on the prescription or handout unless the doctor has approved it.

### 8.3 Facility profile

- **Never suggest** a lab test not in **facility_lab** as an order.
- **Never suggest** an imaging study not in **facility_imaging** as an order.
- **Never suggest** a drug not in **facility_drug** as a prescription.
- **Never suggest** observation, oxygen, IV, nebulization, or other clinical facility use unless that capability is in **facility_clinical_facility**.
- **Never infer** capability from facility type (e.g. assume “hospital” has CT). Only explicit profile entries.

### 8.4 Language and tone

- **Never use** definitive or mandatory language: “Diagnosis is …”, “This confirms …”, “You should prescribe …”, “Mandatory”, “Must”, “Should” (as obligation).
- **Never imply** that the doctor is wrong or negligent for ignoring a suggestion. No warnings, penalties, or negative logs for not accepting suggestions.

### 8.5 Patient output and visibility

- **Never** put unedited engine output directly onto the prescription or any patient-facing document. Only doctor-approved content.
- **Never mention** AI, “suggestion”, or “recommended by system” on patient-visible material. Printed output must look like a standard doctor-written OPD prescription (CLINICAL_GUARDRAILS §7).
- **Never** make differential diagnosis or “suggested” diagnoses visible to the patient unless the doctor has added and finalised that diagnosis.

### 8.6 Blocking and penalties

- **Never block** workflow progression (e.g. “You must complete … before proceeding”). Doctor can always move to the next step.
- **Never create** warnings or penalties for ignoring or dismissing suggestions (CLINICAL_GUARDRAILS §2).

### 8.7 Audit and medicolegal

- **Never** use audit logs to imply doctor negligence. Logs may record suggestions and doctor actions for medicolegal safety but must not be framed to blame the doctor (CLINICAL_GUARDRAILS §8).

### 8.8 Data and scope

- **Never** use patient data to train models. AI access is session-scoped and context-limited (CLINICAL_GUARDRAILS §9).
- **Never** interpret or analyse clinical photos. Photos are for documentation only; no diagnosis or finding derived from them by the engine.

---

## Summary

| Area | AI may | AI must not |
|------|--------|-------------|
| **Triggers** | Activate on complaint, vitals, exam, diagnosis | Activate on finalise/print; block progression |
| **Clinical prompts** | Suggest what to check/document (e.g. Chvostek, ECG) | State that a finding is present or diagnosis confirmed |
| **Differential** | Suggest provisional, ranked differential | Set final/confirmed; show to patient unless doctor finalises |
| **Investigations** | Suggest only from facility profile; alternatives/referral if unavailable | Suggest off-profile tests; auto-order; say “mandatory” |
| **Treatment** | Suggest drug class/examples from profile; dose ranges | Auto-prescribe; suggest off-profile drugs; set dose as final |
| **Advice** | Suggest diagnosis-linked advice, ORS, red flags | Finalise or print without doctor approval; contradict facility |
| **Observation/referral** | Suggest based on vitals, red flags, facility limits | Decide disposition; suggest observation without profile support |
| **General** | Use “Consider”, “May be”, “If clinically indicated” | Finalise, auto-save, use “Diagnosis is”, “Mandatory”, block, blame |

This document defines AI behaviour for the OPD system and is **non-negotiable**. Doctor judgment always wins.
