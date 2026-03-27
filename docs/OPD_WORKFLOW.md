# OPD Visit Workflow

This document defines the **OPD Visit Workflow** for the clinical OPD system. It follows **CLINICAL_GUARDRAILS** and **FACILITY_PROFILE**. One visit = one OPD encounter. The workflow reflects real doctor flow, is fast and low-click, and specifies where AI may assist and where it must stay silent.

**Principles:**
- Doctor is final authority; AI suggests only; nothing is auto-finalized.
- AI suggestions are collapsible and optional; AI never blocks progression or auto-saves/finalizes.
- Drugs and investigations suggested by AI come only from the facility profile.

---

## Workflow Overview

| Step | Screen focus | Doctor action | AI role |
|------|--------------|---------------|---------|
| 1 | Patient identification & summary | Select/confirm patient; review | May suggest; never blocks |
| 2 | Chief complaints | Enter free text and/or structured | May suggest; optional |
| 3 | Vitals | Enter values; abnormal flags shown | May suggest; no hard stops |
| 4 | Examination & findings | Structured exam + free text; optional photo | May suggest; optional |
| 5 | Diagnosis | Provisional/final; visit vs chronic | May suggest; doctor finalizes |
| 6 | Treatment | Drugs, dose, frequency, duration | May suggest from profile only |
| 7 | Investigations | Suggested vs ordered | May suggest from profile only |
| 8 | Advice | Diagnosis-linked; home care; red flags | May suggest; doctor finalizes |
| 9 | Observation vs referral | Plan: discharge vs observe vs refer | May suggest; doctor decides |
| 10 | Finalize & print | Review, finalize, print prescription | Silent; no AI on output |

---

## 1. Patient Identification & Longitudinal Summary (Read-Only)

**Purpose:** Confirm correct patient and show lifetime context for this encounter. No clinical data is entered here; this is read-only context.

**Screen:** Patient identifier (name, ID, DOB, sex) and longitudinal summary.

**Data displayed (read-only):**
- Patient demographics: name, identifier, date of birth, sex, contact.
- **Chronic problem list:** Active and resolved chronic diagnoses (from past visits; doctor-maintained).
- **Recent visits:** Last N visits with date, chief complaint, and final diagnoses (summary only).
- **Current medications:** Long-term drugs from chronic problem list or last visit, if documented.
- **Allergies / significant history:** If recorded in the longitudinal record.

**Data captured at this step:** None. Optionally a single action: “Start OPD visit” (creates the visit and moves to step 2).

**AI assistance:**
- May suggest a short summary of relevant past history based on current chief complaint (once entered in step 2) or prior problems.
- Suggestions are collapsible and optional; doctor can ignore with no penalty or block.
- AI must **not** suggest diagnoses, drugs, or investigations here; only summarise existing record.

**AI must stay silent on:** Any recommendation that sounds like a clinical decision (e.g. “consider adding diagnosis X”). At this step AI may only assist with **summary of existing data**, not conclusions.

**Progression:** No validation gate. Doctor proceeds when ready (e.g. one click to “Start visit” or “Enter complaints”).

---

## 2. Chief Complaints (Free Text + Structured)

**Purpose:** Capture why the patient has come today: free text plus optional structured complaints for later analysis and AI context.

**Screen:** Chief complaint entry.

**Data captured:**
- **Free-text chief complaint:** One or more lines (e.g. “Fever 3 days, cough”, “Follow-up diabetes”). Primary and mandatory for workflow.
- **Structured complaints (optional):** Pick from a facility- or system-defined list (e.g. fever, cough, pain abdomen, headache) to tag the visit. Multiple selection allowed. Supports reporting and optional AI use; not mandatory to proceed.

**AI assistance:**
- May suggest structured tags based on free text (e.g. “Consider tagging: Fever, Cough”). Fully optional; doctor may edit or ignore.
- May not pre-fill or override the free-text chief complaint; doctor types or dictates.

**AI must stay silent on:** Stating or implying a diagnosis (e.g. “This suggests URTI”). Only complaint-level structuring is allowed.

**Progression:** No hard validation. Minimum: free-text chief complaint entered (or explicitly “Follow-up only”). Doctor can move to vitals with one action (e.g. “Next” or “Vitals”).

---

## 3. Vitals Entry (Abnormal Flags, No Hard Stops)

**Purpose:** Record vital signs for the visit. Abnormal values are flagged for attention; the system never blocks or forces a change.

**Screen:** Vitals form.

**Data captured:**
- **Temperature** (optional): value, unit (°C/°F).
- **Pulse** (optional): rate per minute.
- **Blood pressure** (optional): systolic, diastolic; single or multiple readings.
- **Respiratory rate** (optional): per minute.
- **SpO2** (optional): percentage, especially when respiratory complaint or hypoxia suspected.
- **Weight** (optional): kg.
- **Height** (optional): cm (for BMI if both entered).
- **Other:** Any facility-defined vitals (e.g. random blood sugar at triage).

Each value is optional from a workflow perspective. Abnormal flags (e.g. high BP, low SpO2, fever) are shown as **informational only**—e.g. “Above normal range” or “Low SpO2”—with no hard stop, no mandatory comment, and no blocking of “Next”.

**AI assistance:**
- May suggest re-checking a value if clearly implausible (e.g. BP 300/200) in advisory language: “Consider rechecking if not already verified.”
- May suggest additional vitals if chief complaint implies relevance (e.g. “SpO2 may be useful in this complaint”). Optional and collapsible.
- Must **not** block saving or progression based on vitals; no “You must correct this before proceeding.”

**AI must stay silent on:** Diagnosing or concluding from vitals (e.g. “Hypertension” or “Sepsis”). Only range checks and optional suggestions.

**Progression:** No mandatory fields. Doctor can leave any vital blank and proceed. One action to “Next” (e.g. to examination).

---

## 4. Doctor Examination & Findings

**Purpose:** Record clinical examination: structured findings and free-text notes. Optional photo with consent for documentation only.

**Screen:** Examination entry.

**Data captured:**
- **Structured examination (optional):** System/facility-defined exam areas (e.g. general, cardiovascular, respiratory, abdomen, CNS) with normal/abnormal and short findings (e.g. “Clear”, “Crepitations right base”, “Tenderness right iliac fossa”). Each area and finding optional.
- **Free-text clinical notes:** Doctor’s narrative examination notes. No length limit; primary clinical record.
- **Photo (optional):** Upload only with explicit consent (e.g. consent checkbox or consent documented elsewhere). Stored as attachment to visit; not for AI interpretation in this workflow. Consent status (e.g. “Consent for clinical photo documented”) captured; photo linked to visit and patient.

**AI assistance:**
- May suggest structured findings based on chief complaint and vitals (e.g. “Consider documenting respiratory exam if not done”). Collapsible and optional.
- May suggest prompts for free-text notes (e.g. “Consider documenting: throat appearance, lymph nodes”) without generating the note itself. Doctor writes; AI does not auto-fill examination text.
- Must **not** generate or finalize examination text that appears as doctor’s text; only suggest what to document.

**AI must stay silent on:** Stating diagnoses from examination (e.g. “Examination suggests pneumonia”). No interpretation of photos. No auto-saving of examination as “final”.

**Progression:** No mandatory examination fields. Doctor can skip structured exam and/or notes and proceed. One action to “Next” (e.g. to diagnosis).

---

## 5. Diagnosis (Provisional / Final; Visit-Only vs Chronic Problem List)

**Purpose:** Record diagnoses for this visit and optionally update the chronic problem list. Distinction between provisional (working) and final (doctor-confirmed) is explicit.

**Screen:** Diagnosis entry.

**Data captured:**
- **Visit-level diagnoses:** One or more diagnoses for this encounter. Each has:
  - Code/term (from picker or free text).
  - **Provisional vs final:** Marked by doctor (e.g. “Provisional” until confirmed, then “Final”). Only doctor can set “Final”.
  - Primary/secondary (optional).
- **Chronic problem list update (optional):** Add new chronic diagnosis to longitudinal list, or mark existing chronic as “resolved” / “inactive”. Chronic list is patient-level; visit links to it when a chronic problem is addressed this visit.

**AI assistance:**
- May suggest possible diagnoses based on chief complaint, vitals, and examination (advisory language only: “Consider …”, “… may be considered”, “… can be ruled out if clinically indicated”). List is collapsible and optional.
- Doctor selects, edits, or ignores. AI must **not** set any diagnosis as final or provisional; only the doctor does that.
- AI must **not** use definitive language (“Diagnosis is …”, “This confirms …”).

**AI must stay silent on:** Finalising any diagnosis; adding to chronic list without explicit doctor action; stating that a diagnosis is confirmed or mandatory.

**Progression:** No mandatory diagnosis to proceed (e.g. “Undifferentiated fever” or “To be assessed” is allowed). One action to “Next” (e.g. to treatment). Finalising diagnoses can happen later (e.g. at step 10) or here; workflow does not force it before treatment.

---

## 6. Treatment (Drugs from Facility Profile; Dosage, Frequency, Duration)

**Purpose:** Prescribe drugs for this visit. Only facility-profile drugs are suggested by AI; doctor can prescribe off-profile (free text or selection if supported). Dosage, frequency, and duration are captured.

**Screen:** Prescription / treatment entry.

**Data captured per drug:**
- **Drug:** Selected from facility drug list or entered as free text (doctor can always prescribe outside profile).
- **Dose:** e.g. “500 mg”, “1 tablet”.
- **Route:** e.g. oral, topical, injection (optional).
- **Frequency:** e.g. “TDS”, “Once at night”, “SOS”.
- **Duration:** e.g. “5 days”, “1 week”, “As needed”.
- **Instructions:** Free text (e.g. “After food”, “Avoid alcohol”).
- **Provisional vs final:** Prescription is not final until doctor explicitly finalises (e.g. at step 10). Until then, lines are editable/draft.

**AI assistance:**
- May suggest drugs **only from facility profile** (FACILITY_PROFILE). For routine OPD, only drugs with use_context **opd** or **both**; for acute/emergency context, **emergency** or **both**.
- Suggestions use advisory language (“Consider …”, “If clinically indicated …”). Collapsible; doctor selects, edits dose/frequency/duration, or ignores.
- AI must **not** suggest any drug not in the facility profile. AI must **not** set dose/frequency/duration as final; doctor enters or confirms.
- AI must **not** auto-add any drug to the prescription; only suggest. Doctor adds to the list.

**AI must stay silent on:** “You should prescribe …”; “Mandatory”; suggesting drugs not in facility profile; finalising or auto-saving prescription.

**Progression:** No mandatory drugs. Doctor can leave treatment empty (e.g. advice only) and proceed. One action to “Next” (e.g. to investigations).

---

## 7. Investigations (Suggested vs Ordered; Facility Profile Only)

**Purpose:** Record what investigations are **suggested** (by AI or doctor) vs **ordered** (doctor-confirmed). Only facility-profile tests may be suggested by AI.

**Screen:** Investigations (lab and imaging).

**Data captured per investigation:**
- **Type:** Lab or imaging.
- **Test/study:** From facility lab or facility imaging list when ordered; doctor can also order by free text (off-profile).
- **Status:** **Suggested** (not yet ordered) vs **Ordered** (doctor has confirmed). Only “Ordered” appears on the printed investigation slip / prescription. Optional: **Result** (later) or “Sent”; not required for workflow.
- **Clinical notes (optional):** Indication or note for the lab/imaging dept.

**Suggested vs ordered:**
- **Suggested:** Shown in a separate area (e.g. “Suggestions” or “Consider”). Doctor can promote to “Ordered” with one action, edit (e.g. change test), or dismiss. AI suggestions appear here only; they are never auto-promoted to ordered.
- **Ordered:** Only after explicit doctor action (e.g. “Add to orders”, “Order”). This is what is printed and sent to lab/radiology.

**AI assistance:**
- May suggest investigations **only from facility profile** (facility_lab, facility_imaging). No suggestion of tests not in the profile.
- Suggestions are advisory (“Consider …”, “May be checked if clinically indicated …”). Collapsible; doctor orders, edits, or ignores.
- If an ideal test is not in the profile, AI must **not** suggest it as an order; it may suggest clinical examination, observation (if in profile and safe), or referral (FACILITY_PROFILE, CLINICAL_GUARDRAILS §4).

**AI must stay silent on:** Suggesting any lab or imaging not in facility profile; auto-promoting suggestions to ordered; stating that a test is mandatory.

**Progression:** No mandatory investigations. Doctor can leave none or any number ordered. One action to “Next” (e.g. to advice).

---

## 8. Advice (Diagnosis-Linked; Home Care, Diet, Fluids, Red Flags)

**Purpose:** Document advice for the patient: home care, diet, fluids, activity, and when to return or seek care (red flags). Optionally link advice to specific diagnoses.

**Screen:** Advice entry.

**Data captured:**
- **General advice:** Free text (e.g. “Rest, avoid exertion”, “Complete course of antibiotics”).
- **Diet / fluids:** Free text or structured options (e.g. “Light diet”, “Plenty fluids”, “ORS if loose stools”).
- **Red flags / when to return:** What symptoms or signs should prompt immediate return or referral (e.g. “Return if fever persists >3 days”, “Come to ER if breathlessness or chest pain”). Critical for medicolegal and safety.
- **Diagnosis-linked advice (optional):** Associate a block of advice to a visit diagnosis (e.g. “For URTI: steam, rest, fluids”).

**AI assistance:**
- May suggest advice text based on diagnoses and facility context (e.g. standard home-care advice for URTI, red flags for fever). Advisory language; collapsible; doctor edits or accepts.
- May suggest red-flag phrases (e.g. “Return if …”, “Seek care if …”). Doctor must approve; only doctor-approved text appears on printed prescription (CLINICAL_GUARDRAILS §7).
- AI must **not** finalise or auto-print advice; doctor must explicitly include it in the final prescription.

**AI must stay silent on:** Stating advice as mandatory; putting unedited AI text onto patient-facing output without doctor approval; generating advice that contradicts facility limits (e.g. “Get CT done here” when CT is not in profile—instead suggest referral if needed).

**Progression:** No mandatory advice. One action to “Next” (e.g. to observation/referral).

---

## 9. Observation vs Referral (Suggested from Vitals, Red Flags, Facility Limits)

**Purpose:** Decide and document disposition: **discharge home**, **observation at this facility**, or **referral** to another facility/specialist. AI may suggest based on vitals, red flags, and facility profile; doctor decides and documents.

**Screen:** Disposition / plan.

**Data captured:**
- **Disposition:** One of: **Discharge** (home), **Observation** (at this facility), **Referral** (to another facility or specialist).
- **Observation (if selected):** Reason, plan (e.g. “Observe 4 hours, recheck vitals”), and confirmation that facility has the capability (from facility_clinical_facility—e.g. observation bed, oxygen). Doctor selects; AI only suggests if observation is in profile.
- **Referral (if selected):** Reason, destination (e.g. “Emergency department”, “Cardiologist”), and optional note. No auto-referral; doctor writes or selects.

**AI assistance:**
- May suggest observation **only if** facility profile includes observation (and relevant support like oxygen/IV if needed) (FACILITY_PROFILE). Language: “Observation may be considered if …”, “Consider referral if …”.
- May suggest referral when vitals, red flags, or lack of facility capability make it clinically reasonable (e.g. “If clinically indicated, consider referral for …”). Collapsible and optional.
- If critical support (e.g. oxygen, IV) is not in profile, AI must **not** say this facility can provide it; may suggest referral to a facility that can (FACILITY_PROFILE §3.4).

**AI must stay silent on:** Auto-selecting disposition; finalising observation or referral; implying the doctor must choose a particular option; using mandatory language.

**Progression:** Doctor must select disposition (discharge / observation / referral). One action to “Next” (e.g. to finalize). No default disposition forced by system; doctor chooses.

---

## 10. Finalize & Print Prescription

**Purpose:** Review the full visit, explicitly finalise all doctor-approved content, and print the prescription. No AI on the printed output; only doctor-finalised data appears.

**Screen:** Visit summary and finalise.

**Data shown for review:**
- Chief complaint, vitals, examination summary, diagnoses, drugs (dose/frequency/duration), investigations ordered, advice, disposition (observation/referral if applicable).

**Data captured at this step:**
- **Finalise action:** Doctor explicitly confirms that visit-level diagnoses, prescriptions, investigations, and advice are **final**. Until then they remain draft/provisional. Timestamp and doctor identity recorded.
- **Print:** Generate prescription document for patient. Content = only doctor-finalised items: final diagnoses, final prescription lines, final investigations ordered, final advice, follow-up and red flags. No “suggested” or “AI” section on the prescription (CLINICAL_GUARDRAILS §7).

**AI assistance:**
- **None** on this screen. No suggestions, no summaries, no text on the prescription. This step is doctor-only: review, finalise, print.

**AI must stay silent on:** Entire step. Printed output must look like a standard doctor-written OPD prescription; it must never mention AI.

**Progression:** Doctor clicks “Finalise” (or equivalent), then “Print” (or equivalent). After finalise, edits may be restricted or require “unfinalise” per policy; workflow does not force that—design choice. Visit can be closed after print.

---

## AI Rules Summary (Cross-Cutting)

| Rule | Application |
|------|-------------|
| **Suggest only** | AI may suggest at each step where specified; suggestions are optional and editable. |
| **Collapsible & optional** | AI suggestions are shown in a way that can be collapsed/hidden; doctor can ignore with no penalty. |
| **Never block** | No step requires accepting or acting on an AI suggestion to proceed. |
| **Never auto-save or finalise** | AI never saves clinical data or marks anything as final; only the doctor does. |
| **Facility profile** | For drugs and investigations, AI suggests only from facility profile; for observation/IV/oxygen, only if in facility clinical facilities. |
| **Safe language** | “Consider”, “May be checked”, “If clinically indicated”; never “Diagnosis is”, “You should prescribe”, “Mandatory”. |
| **Patient output** | Printed prescription contains only doctor-approved content; no AI mention. |
| **Doctor wins** | Any conflict between AI suggestion and doctor action: doctor judgment always wins. |

---

## Low-Click / Fast Workflow Notes

- **Minimum path:** Patient → chief complaint (free text) → vitals (optional) → examination (optional) → diagnosis (optional) → treatment (optional) → investigations (optional) → advice (optional) → disposition (required) → finalise & print. No step has mandatory fields except disposition and (for print) finalise.
- **Single “Next” per step:** One primary action moves from each step to the next; no nested mandatory sub-steps.
- **Suggestions in one place:** AI suggestions grouped (e.g. one collapsible panel per step); accept/edit/dismiss without extra screens.
- **Finalise once:** One “Finalise” at step 10 marks visit-level clinical data as final; no per-section finalise required unless facility policy wants it.

This workflow supports small clinics, nursing homes, and tertiary hospitals while keeping the doctor in control and AI in an advisory, non-blocking role.
