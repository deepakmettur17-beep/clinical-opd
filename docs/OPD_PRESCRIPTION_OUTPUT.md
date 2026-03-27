# OPD Prescription Output

This document defines the **final OPD prescription output** for the clinical OPD system. It follows **CLINICAL_GUARDRAILS** (§7 Patient Output Rules), **OPD_WORKFLOW** (Step 10 Finalise & Print), and **AI_CLINICAL_ENGINE** (no AI on patient output).

**Principles:**
- Clean, printable, one-page OPD prescription.
- **Doctor-approved content only.** Nothing appears on the prescription unless the doctor has explicitly finalised it.
- **AI must NOT be mentioned anywhere** on patient-facing output. Printed output must look like a standard doctor-written OPD prescription.
- Pure clinical and legal clarity.

---

## 1. Document Type and Scope

**Output:** One printed (or electronic) prescription document per OPD visit, generated only after the doctor has **finalised** the visit.

**Audience:** Patient (and carers) hold the prescription; it may be shown to other clinicians, pharmacy, or lab. Nothing on the document is "internal only" from the patient's perspective—everything printed is intended for the patient to see and use. Internal/hidden elements (e.g. visit ID, audit references) are defined below and must not imply AI or system authorship.

**Source of content:** Every line of clinical content (diagnosis, medicines, investigations, advice, follow-up, referral summary) comes **only** from doctor-finalised data. No suggested or draft text; no AI-generated text unless the doctor has explicitly edited and approved it as their own.

---

## 2. Sections in Exact Order

The prescription is composed of sections in the following order. Sections that have no doctor-finalised content may be omitted or shown as "—" or left blank, so long as the structure is clear and the document remains one page where possible.

| Order | Section | Purpose |
|-------|---------|---------|
| 1 | **Header** | Facility name; document title ("OPD Prescription" or "Prescription"). |
| 2 | **Patient identification** | Patient name, identifier (e.g. MR number/OP number), date of birth, sex (optional per facility). |
| 3 | **Visit date and doctor** | Date of visit; treating doctor name; registration number (if applicable); optional: facility address/contact. |
| 4 | **Diagnosis** | Final visit-level diagnoses as finalised by the doctor. |
| 5 | **Medicines** | Final prescription lines: drug name, dose, route, frequency, duration, instructions. |
| 6 | **Investigations ordered** | Final lab and imaging orders as finalised by the doctor. |
| 7 | **Advice** | Diet, fluids, home care, ORS (if applicable), other instructions. |
| 8 | **Red flags / when to return** | Symptoms or signs that should prompt return or emergency care. |
| 9 | **Follow-up** | Next visit date or interval; follow-up instructions. |
| 10 | **Referral / transfer summary** (optional) | Present only if disposition is referral or transfer; brief reason and destination. |
| 11 | **Medicolegal and attestation** | Short statements of authenticity and patient responsibility; date; signature. |

---

## 3. Section-by-Section: What Is Shown to Patient

The following is what the **patient sees** on the prescription. All text is from doctor-finalised fields only.

### 3.1 Header

**Shown to patient:**
- Facility name (e.g. "City Clinic", "Sunrise Nursing Home").
- Document title: "OPD Prescription" or "Prescription" (or equivalent in local language).

**Hidden / internal:**  
- Facility ID, internal codes. (If printed for system use, these may appear on a duplicate or footer not given to the patient; otherwise omit from patient copy.)

---

### 3.2 Patient identification

**Shown to patient:**
- Patient full name.
- Patient identifier (e.g. MR number, OPD number) as used by the facility.
- Date of birth (optional per facility policy).
- Sex (optional per facility policy).

**Hidden / internal:**  
- Internal patient UUID or system IDs must not appear on the patient copy. If a barcode or QR is used for facility use, it may be on a duplicate copy only; patient copy remains free of internal IDs if policy requires.

---

### 3.3 Visit date and doctor

**Shown to patient:**
- **Date of visit** (date of this OPD encounter).
- **Treating doctor name** (full name as used for prescriptions).
- **Registration number** (medical council or facility registration number, if applicable and if the doctor has consented to its display).
- Optional: facility address and/or contact number.

**Hidden / internal:**  
- Doctor user ID, session ID, visit UUID. Not on patient copy.

---

### 3.4 Diagnosis

**Shown to patient:**
- List of **final visit-level diagnoses** as finalised by the doctor for this visit.
- One line per diagnosis (or grouped if facility prefers). No "provisional" or "suggested" label on the prescription—only diagnoses the doctor has marked final for this output.
- If the doctor finalised no diagnosis, the section may show "—" or "As discussed" or be omitted per facility policy.

**Hidden / internal:**  
- Provisional diagnoses, differential lists, AI-suggested diagnoses, and any "suggested" status are never shown. Only doctor-finalised diagnoses appear.

---

### 3.5 Medicines

**Shown to patient:**
- Each **final** prescription line:
  - Drug name (as written by or approved by the doctor).
  - Dose (e.g. "500 mg", "1 tablet").
  - Route (e.g. "oral", "topical") if the doctor included it.
  - Frequency (e.g. "TDS", "Once at night", "SOS").
  - Duration (e.g. "5 days", "1 week", "As directed").
  - Instructions (e.g. "After food", "Avoid alcohol") if the doctor included them.
- Numbered or bulleted list. No drug appears unless the doctor has finalised it for this prescription.

**Hidden / internal:**  
- Suggested drugs, draft lines, AI-suggested doses. Not on prescription.

---

### 3.6 Investigations ordered

**Shown to patient:**
- List of **final** lab tests and imaging studies **ordered** by the doctor (not "suggested").
- Each line: name of test or study (e.g. "CBC", "ECG", "X-ray Chest"); optional brief indication if the doctor added it.
- Only investigations the doctor has marked as **ordered** (not merely suggested) appear.

**Hidden / internal:**  
- Suggested investigations, AI suggestions, "consider" lists. Not on prescription.

---

### 3.7 Advice

**Shown to patient:**
- **Diet:** e.g. "Light diet", "Bland diet", "As tolerated"—exactly as finalised by the doctor.
- **Fluids:** e.g. "Plenty oral fluids", "ORS as needed"—as finalised.
- **Home care:** e.g. "Rest", "Steam inhalation", "Complete course of antibiotics"—as finalised.
- **Other advice:** Any other instructions the doctor finalised (e.g. wound care, activity).
- Diagnosis-linked advice may be grouped under a diagnosis or listed generally, as the doctor finalised.

**Hidden / internal:**  
- Unedited AI-generated advice, suggested text not approved by the doctor. Not on prescription.

---

### 3.8 Red flags / when to return

**Shown to patient:**
- Clear instructions on **when to return** or **when to seek emergency care**, as finalised by the doctor.
- Examples of wording (see Wording guidelines below): "Return if …", "Seek emergency care if …", "Contact the clinic if …".
- This section is important for patient safety and medicolegal clarity. If the doctor finalised no red-flag text, the section may be omitted or show "As discussed."

**Hidden / internal:**  
- AI-suggested red flags that the doctor did not approve. Not on prescription.

---

### 3.9 Follow-up

**Shown to patient:**
- **Next visit:** Date or interval (e.g. "Review in 1 week", "Follow-up on [date]").
- **Follow-up instructions:** e.g. "Bring reports", "Continue medications", "Return earlier if symptoms worsen"—as finalised by the doctor.

**Hidden / internal:**  
- Suggested follow-up that the doctor did not finalise. Not on prescription.

---

### 3.10 Referral / transfer summary (optional)

**Shown to patient (only if disposition is referral or transfer):**
- **Reason for referral/transfer:** Brief, patient-appropriate reason (e.g. "For further evaluation of chest pain", "For specialist opinion").
- **Destination:** e.g. "Emergency department, XYZ Hospital", "Cardiologist", "Higher centre".
- **Optional:** Short note the doctor wants the receiving clinician or patient to know (e.g. "Reports attached", "On treatment for …").

**Hidden / internal:**  
- Internal referral IDs, workflow state. Not required on patient copy unless facility policy includes them in a minimal form (e.g. referral slip number for tracking).

---

### 3.11 Medicolegal and attestation

**Shown to patient:**
- **Date of issue** (or visit date) and **signature** of the treating doctor (wet signature or legally acceptable electronic signature per jurisdiction).
- **Short medicolegal statements** (see Medicolegal safety statements below). These confirm that the prescription is issued by the treating doctor and that the patient is responsible for following it and disclosing allergies/errors.

**Hidden / internal:**  
- Audit log references, system version. Not on patient copy.

---

## 4. What Is Hidden / Internal (Never on Patient Output)

The following must **not** appear on the prescription or any patient-facing output:

- **AI, assistant, or decision-support:** No mention of "AI", "suggestion", "recommended by system", "computer-generated", or similar. The document must read as a standard doctor-written OPD prescription.
- **Suggested vs ordered:** No "suggested" diagnoses, drugs, or investigations. Only finalised/ordered items appear.
- **Provisional status:** No "provisional diagnosis" or "to be confirmed" on the prescription unless the doctor explicitly finalised that wording as what they want the patient to see.
- **Internal identifiers:** No visit UUID, patient UUID, doctor user ID, session ID, or internal codes unless facility policy explicitly requires a minimal identifier (e.g. prescription number) for the patient copy.
- **Audit or logging:** No "for audit", "logged", or references to internal audit trails.
- **Draft or unapproved text:** No text that the doctor did not explicitly approve for this prescription.

---

## 5. Wording Guidelines for Advice and Red Flags

These guidelines ensure advice and red flags are clear to the patient and defensible medicolegally. All text on the prescription is **doctor-finalised**; the guidelines apply to how the doctor (or the system on the doctor’s behalf) phrases that final text.

### 5.1 General advice

- Use **simple, direct language** the patient can follow (e.g. "Rest at home", "Drink plenty fluids", "Complete the full course of antibiotics").
- Avoid jargon where possible; if a term is needed, the doctor may add a brief explanation.
- **Do not** use mandatory or alarming wording that the doctor did not intend (e.g. "You must" unless the doctor explicitly wants that). Prefer "Please …", "Try to …", "It is important to …" where appropriate.

### 5.2 Diet and fluids

- **Diet:** Be specific where it matters (e.g. "Light diet", "Bland diet", "Avoid spicy and oily food", "Normal diet as tolerated").
- **Fluids:** Clear and actionable (e.g. "Plenty oral fluids", "At least 8–10 glasses of water per day", "ORS after each loose motion").
- **ORS:** If ORS is advised, include **how much and when** (e.g. "ORS: 50–100 ml after each loose stool in children; as directed on packet"). Dose by age/weight may be in the doctor’s final text (e.g. "As per packet instructions for age").

### 5.3 Red-flag return instructions

- **Purpose:** Tell the patient clearly when to return to the clinic or when to seek emergency care. This protects the patient and supports medicolegal clarity.
- **Wording:** Use "Return if …", "Come back to the clinic if …", "Seek emergency care if …", "Go to the nearest hospital if …". Be specific about symptoms or signs (e.g. "Return if fever persists more than 3 days", "Seek emergency care if you develop breathlessness, chest pain, or drowsiness").
- **Tone:** Clear and calm. Avoid wording that could be read as the system or a third party instructing the patient; the prescription is from the treating doctor.
- **Scope:** Red flags should match the clinical context (e.g. for URTI: fever duration, breathing difficulty; for abdominal pain: vomiting, inability to pass stools/urine, severe pain). The doctor approves the final list.

### 5.4 Follow-up

- **When:** Clear date or interval (e.g. "Review in 7 days", "Follow-up on [date]", "Return after 1 week or earlier if needed").
- **What to bring:** If relevant (e.g. "Bring all reports", "Bring current medicines").
- **Conditional:** If appropriate (e.g. "Return earlier if symptoms worsen or new symptoms appear").

---

## 6. Medicolegal Safety Statements

The prescription must include **short medicolegal statements** that:

1. **Attest authenticity:** The prescription is issued by the treating doctor for the stated patient and visit date.
2. **Clarify patient responsibility:** The patient is responsible for following the prescription, disclosing allergies and other medicines, and reporting errors or reactions.

**Placement:** At the bottom of the prescription, before or adjacent to the doctor’s signature and date.

**Example statements (wording to be adapted per jurisdiction and facility):**

- **Authenticity:** "This prescription is issued by the undersigned treating doctor for the patient named above on the date of visit stated."
- **Patient responsibility:** "The patient is advised to follow the prescription as directed, to inform the doctor or pharmacist of any known allergies or current medications, and to report any adverse effect or error."

**Rules:**
- Statements must be **short** and **readable**. Legal team may refine for local law.
- No mention of AI, system, or decision-support. The document is the doctor’s prescription.
- Signature and date (and registration number if shown) confirm the doctor’s approval of the entire content.

---

## 7. One-Page Layout and Print

- **Target:** One page for a typical OPD visit (diagnosis, few medicines, investigations, advice, follow-up, referral if any, attestation, signature).
- **If content overflows:** Prioritise for the first page: header, patient, date/doctor, diagnosis, medicines, investigations, key advice, red flags, follow-up, referral (if any), medicolegal statements, signature. Continuation to a second page may be used for long medicine lists or long advice; both pages together form one prescription and should be clearly numbered (e.g. "Page 1 of 2").
- **Readability:** Font and spacing suitable for patients (including elderly); facility name and doctor name clearly visible.
- **Signature:** Space for wet or electronic signature; date of issue (or visit date) next to signature.

---

## 8. Summary: Content Rules

| Item | Rule |
|------|------|
| **Source** | Only doctor-finalised data. No draft, suggested, or AI-only content. |
| **AI** | Not mentioned anywhere on patient output. |
| **Diagnosis** | Only final visit-level diagnoses finalised by the doctor. |
| **Medicines** | Only final prescription lines (dose, frequency, duration, instructions). |
| **Investigations** | Only orders finalised by the doctor (not suggestions). |
| **Advice** | Only doctor-finalised diet, fluids, home care, ORS. |
| **Red flags** | Only doctor-finalised "when to return" / "when to seek emergency care". |
| **Follow-up** | Only doctor-finalised date/interval and instructions. |
| **Referral** | Optional section; only if disposition is referral/transfer; doctor-finalised reason and destination. |
| **Attestation** | Date, doctor name, registration number (if applicable), signature, short medicolegal statements. |
| **Hidden** | No AI, no "suggested", no internal IDs, no audit references on patient copy. |

This design ensures a clean, one-page OPD prescription with clear separation of diagnosis, medicines, investigations, advice, and follow-up, medicolegal clarity, and no AI mention on patient output, in line with CLINICAL_GUARDRAILS, OPD_WORKFLOW, and AI_CLINICAL_ENGINE.
