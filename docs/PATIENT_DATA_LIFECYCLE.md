# Patient Data Lifecycle

This document defines the **patient data lifecycle** for the OPD clinical system. It establishes **patient rights** and **system obligations** with respect to data categories, ownership, portability, retention, immutability, and external sharing. It follows **CLINICAL_GUARDRAILS**, **OPD_WORKFLOW**, **OPD_PRESCRIPTION_OUTPUT**, and **SYSTEM_ARCHITECTURE**.

**Principles:**
- Patient data is held by the facility for clinical care; the patient has rights to access, portability, and consent over sharing.
- The doctor controls clinical content (diagnosis, treatment, advice) and finalisation; the system protects integrity, audit, and privacy.
- No assumptions about cloud, national health ID, or live syncing; design works with local or facility-level deployment.

**Scope:** This document uses plain legal and clinical language. It does not specify code or UI; it defines what the system must do and what the patient can expect.

---

## 1. Data Categories

Patient-related data in the system falls into four categories. Each has a distinct purpose, lifecycle, and rules for access, edit, and sharing.

---

### 1.1 Demographics

**Definition:** Identifying and contact information for the patient, as recorded at the facility.

**Typical content:** Full name; facility-assigned identifier (e.g. MR number, OPD number); date of birth; sex; contact number; address; optionally guardian or next-of-kin for minors or dependent patients.

**Purpose:** Correct identification of the patient; contact and follow-up; display on prescriptions and summaries.

**Lifecycle:** Created when the patient is first registered at the facility. May be updated by authorised staff (e.g. correction of name, contact, address). No automatic overwrite from external systems unless the facility explicitly implements such a feed and the patient has consented where required.

**Retention:** Retained for as long as the facility holds the patient record, subject to facility and legal retention policy.

---

### 1.2 Longitudinal Medical History

**Definition:** Patient-level, lifetime medical information that spans visits: chronic problem list, long-term medications, allergies, significant past history, and similar.

**Typical content:** Chronic diagnoses (active and resolved); long-term or current medications from past visits; allergies and adverse reactions; significant past medical history (e.g. surgery, major illness); optionally immunisation summary or other facility-defined longitudinal data.

**Purpose:** Context for every OPD visit; continuity of care; safe prescribing and advice.

**Lifecycle:** Built and maintained over time. Updated when the doctor adds or resolves a chronic diagnosis, documents long-term medications, or records allergies or significant history. Additions and changes are made by the treating doctor or authorised clinician; the system does not auto-populate clinical conclusions (e.g. no auto-diagnosis, no auto-prescribing). Edits to longitudinal history are subject to facility policy (e.g. who may correct allergies, who may resolve a chronic problem).

**Retention:** Retained for as long as the facility holds the patient record, subject to facility and legal retention policy.

---

### 1.3 Visit-Specific Clinical Data

**Definition:** All clinical data that belongs to a single OPD encounter: chief complaint, vitals, examination, diagnoses (visit-level), prescriptions, investigations ordered, advice, red flags, follow-up, disposition (discharge, observation, referral).

**Typical content:**
- **Draft:** Data entered by the doctor but not yet finalised (e.g. provisional diagnosis, draft prescription line). Editable until finalise; not included in the prescription or in “ordered” investigations.
- **Finalised:** Data the doctor has explicitly confirmed at finalise (workflow step 10). Used for the prescription, investigation slip, and referral summary. After finalisation, edit is restricted or requires an explicit “unfinalise” or “correction” process per facility policy.

**Purpose:** Clinical record of the encounter; source for the prescription and other patient-facing documents; medicolegal record.

**Lifecycle:** Created when a visit is started; updated as the doctor enters or edits draft data; locked or restricted when the doctor finalises the visit. Only doctor-finalised content appears on the prescription (OPD_PRESCRIPTION_OUTPUT). No automatic finalisation; no AI-written clinical content unless the doctor has explicitly approved it as their own.

**Retention:** Retained per facility and legal policy. Finalised visit data is the authoritative record for that encounter.

---

### 1.4 Audit Logs

**Definition:** A silent, append-only record of certain actions related to the visit: for example, suggestion shown, doctor edit, finalise action. Used for medicolegal and operational integrity; not for clinical care.

**Typical content:** Timestamp; facility; visit identifier; doctor identifier; action type (e.g. suggestion_shown, edit, finalise); entity type (e.g. diagnosis, prescription); optional non-PHI summary. No full clinical text in the log unless facility policy explicitly allows minimal context; audit must never imply doctor negligence (CLINICAL_GUARDRAILS §8).

**Purpose:** Medicolegal safety; accountability; investigation of incidents or disputes. Not for patient care or patient-facing output.

**Lifecycle:** Entries are appended only; no update or delete of existing entries. Corrections (if policy allows) are made by adding a new corrective entry; the original entry remains unchanged. Audit logs are not visible to patients and are not part of the patient’s clinical record for portability or sharing unless required by law or court order.

**Retention:** Retained per facility and legal policy. Access restricted to authorised roles (e.g. facility admin, medicolegal review).

---

## 2. Ownership and Control

### 2.1 What the Patient Owns (Rights)

The patient has the following rights with respect to their data. The facility and system must support these within the limits of law and clinical safety.

- **Right to know:** The patient may be informed what data the facility holds about them (demographics, longitudinal history, visit records), in plain language, subject to facility process.
- **Right to access:** The patient may request access to their clinical record (demographics, longitudinal history, visit-specific data) in the form of a summary or visit-wise export, subject to facility process and lawful exceptions (e.g. harm to self or others, third-party confidentiality).
- **Right to portability:** The patient may request a copy of their data in a usable form (e.g. downloadable patient summary, visit-wise PDF or structured export, referral summary) as described in Portability below. The system must support generation of these outputs from doctor-finalised and authorised data only.
- **Right to consent for external sharing:** The patient’s explicit consent must be obtained before sharing their data with external parties (e.g. another hospital, insurer, family member), unless law requires or permits sharing without consent. The system must not share patient data externally without consent or legal basis (CLINICAL_GUARDRAILS §9).
- **Right to correction (where applicable):** The patient may request correction of factual errors in demographics or, where policy allows, in other non-clinical data. Correction of clinical content (diagnosis, treatment, advice) is a clinical and medicolegal matter; the treating doctor or authorised clinician decides, and corrections may be documented as such (e.g. addendum, correction note) rather than overwriting the original finalised record, per facility policy.

**Limits:** The patient does not “own” the facility’s clinical record in the sense of deleting or altering it at will. The facility holds the record for care and legal obligations. Patient rights are exercised through requests to the facility; the facility responds in line with policy and law.

---

### 2.2 What the Doctor Controls

The treating doctor has the following control over clinical data, within the bounds of professional and facility policy.

- **Clinical content:** The doctor decides and documents chief complaint, vitals, examination, diagnosis (visit-level and chronic list updates), prescription, investigations ordered, advice, red flags, follow-up, and disposition. The system does not auto-diagnose, auto-prescribe, or auto-order; all final content is explicitly confirmed by the doctor (CLINICAL_GUARDRAILS §1, §3).
- **Finalisation:** Only the doctor (or an authorised delegate per facility policy) may finalise a visit. No automatic or system-triggered finalisation. Once finalised, the content of that visit is used for the prescription and for “ordered” investigations; subsequent edit may require unfinalise or correction process per facility policy.
- **Longitudinal updates:** The doctor adds or resolves chronic diagnoses, documents long-term medications, and records allergies or significant history. The system does not auto-populate these from external sources unless the facility has explicitly implemented such a feed and the doctor approves.
- **Identity and signature:** The prescription and other patient-facing documents carry the treating doctor’s name and, if applicable, registration number. The doctor signs (wet or legally acceptable electronic signature) and attests to the prescription. The system does not forge or generate the doctor’s signature.

**Limits:** The doctor’s control is over clinical content and finalisation, not over system security, audit immutability, or patient rights to access and portability. The system must protect audit and data integrity regardless of doctor action.

---

### 2.3 What the System Must Protect

The system has the following obligations to protect data and rights.

- **Integrity:** Clinical and demographic data must be stored and transmitted in a way that prevents unauthorised alteration or loss. Draft and finalised state must be clearly distinguished; only doctor-initiated finalise may set finalised state.
- **Audit immutability:** Audit log entries, once written, must not be altered or deleted. Append-only storage and access control must enforce this. Audit must never be used to imply doctor negligence (CLINICAL_GUARDRAILS §8).
- **Access control:** Access to patient data must be restricted to authorised users (e.g. treating doctors, authorised staff) and scoped by facility and role. Patient data must not be exposed to the AI service except in a session-scoped, context-limited way for suggestions; patient data must not be used to train AI models (CLINICAL_GUARDRAILS §9).
- **No external sharing without consent or law:** The system must not share patient data with external parties (other facilities, insurers, third parties) without the patient’s explicit consent or a clear legal basis (CLINICAL_GUARDRAILS §9).
- **Patient-facing output:** Prescriptions and other patient-facing documents must contain only doctor-approved content; no AI mention; no suggested or draft content (OPD_PRESCRIPTION_OUTPUT, CLINICAL_GUARDRAILS §7).
- **Isolation:** Patient data must be isolated by facility (and by visit where relevant). No cross-facility or cross-patient leakage; no live syncing to external systems unless the facility explicitly implements it with consent and security controls.

---

## 3. Portability

The patient may request a copy of their data in a usable form. The system must support the following export types. No assumption is made about cloud or national health ID; exports are file-based or printable, and the facility delivers them by the means it supports (e.g. download, print, USB, secure link).

---

### 3.1 Downloadable Patient Summary

**Definition:** A single document or structured file that summarises the patient’s record at the facility: demographics, chronic problem list, long-term medications, allergies, significant history, and a summary of recent visits (e.g. date, chief complaint, final diagnoses).

**Content:** Only data the facility holds and is authorised to release. No audit log. No suggested or draft-only content; longitudinal and visit summaries reflect doctor-documented and, where applicable, finalised data.

**Format:** Human-readable (e.g. PDF) and optionally machine-readable (e.g. structured export) if the facility supports it. No assumption about national or regional health record format; facility may map to a local standard if required.

**Purpose:** Patient’s own reference; handover to another clinician or facility; continuity of care.

**Process:** Requested by the patient (or legal representative); fulfilled by the facility per policy (e.g. identity check, consent, timeline). Generated from current data at the time of request; no live syncing—export is a point-in-time snapshot.

---

### 3.2 Visit-Wise Export (PDF or Structured)

**Definition:** Per-visit export of the clinical record for one or more OPD visits: for each visit, the equivalent of the prescription plus any additional visit-level data the facility includes (e.g. vitals, examination summary).

**Content per visit:** Patient identification; visit date; treating doctor name and registration number (if applicable); final diagnoses; final prescription lines; final investigations ordered; final advice; red flags; follow-up; referral/transfer summary if applicable. Optionally vitals, chief complaint, examination summary if facility policy includes them in the visit export. No suggested or draft content; no AI mention. Same content rules as OPD_PRESCRIPTION_OUTPUT for prescription sections.

**Format:** PDF (e.g. one per visit or combined) and optionally structured (e.g. JSON, XML) if the facility supports it. Printable and storable by the patient.

**Purpose:** Patient’s record of each encounter; referral or transfer to another facility; medicolegal or insurance use if the patient chooses to share.

**Process:** Requested by the patient or by the treating doctor (e.g. for referral). Generated from finalised visit data only. No live syncing; export is a point-in-time snapshot of the selected visit(s).

---

### 3.3 Referral Summary

**Definition:** A short document for referral or transfer: patient identification; visit date; treating doctor and facility; reason for referral/transfer; destination; key clinical summary (e.g. chief complaint, final diagnoses, current treatment, allergies); optional copy of prescription or investigation orders.

**Content:** Doctor-finalised content only. No suggested or draft content; no AI mention. Aligned with the referral/transfer section of OPD_PRESCRIPTION_OUTPUT when disposition is referral or transfer.

**Format:** Printable (e.g. PDF) or paper; optionally file (e.g. PDF) for the patient to carry or send. No assumption that the receiving facility has live access to the system; sharing is by file or paper unless the facility has a separate integration.

**Purpose:** Handover to the receiving clinician or facility; continuity of care; patient’s own copy.

**Process:** Generated at or after finalise when disposition is referral or transfer. May be printed at the facility or exported for the patient to take or send. No live push to external systems unless the facility explicitly implements it with consent and security.

---

### 3.4 Portability Rules (Summary)

- Exports contain only **doctor-finalised** (and, where applicable, authorised longitudinal) data. No suggested or AI-only content.
- Exports are **point-in-time**; no assumption of live syncing with other systems or national IDs.
- **Patient consent** is required for sharing exports with third parties (e.g. another hospital, insurer), unless law requires or permits otherwise.
- The **facility** is responsible for verifying identity and consent and for delivering the export by the means it supports (download, print, USB, secure link). This document does not assume cloud storage or national health ID integration.

---

## 4. Retention and Immutability

### 4.1 What Can Be Edited

- **Demographics:** May be corrected or updated by authorised staff (e.g. name, contact, address, date of birth correction). Facility policy defines who may edit and whether a note or audit trail is required.
- **Longitudinal medical history:** May be updated by the treating doctor or authorised clinician: add or resolve chronic diagnosis, update long-term medications, add or correct allergies or significant history. Edits are part of the clinical record; facility policy may require a note or addendum for material corrections.
- **Draft visit data:** All visit-specific data that is **not yet finalised** may be edited or removed by the doctor during the visit. Until finalise, nothing from the visit is included in the prescription or in “ordered” investigations.
- **After finalise:** Edits to finalised visit data are **restricted**. Facility policy must define whether and how corrections are allowed (e.g. unfinalise and re-edit, or addendum/correction note without overwriting the original). The original finalised record remains the medicolegal record unless a lawful correction process overwrites it and documents the change; audit trail rules (below) apply.

---

### 4.2 What Becomes Locked After Finalisation

- **Finalised visit content:** Once the doctor finalises the visit, the diagnoses, prescription lines, investigations ordered, advice, red flags, follow-up, and disposition that were marked final are **locked** for the purpose of the prescription and investigation slip. That locked snapshot is what is used for printing and for visit-wise export. Subsequent correction (if allowed) is via facility policy (e.g. addendum, correction note, or unfinalise-and-refinalise with audit).
- **Prescription output:** The prescription document, once generated, is a point-in-time document. It is not automatically updated if the facility later allows an addendum to the visit; a new document may be generated if policy permits.
- **Audit log:** Each audit entry, once written, is **immutable**. No edit or delete. Correction (if policy allows) is by a new corrective entry; the original remains (SYSTEM_ARCHITECTURE).

---

### 4.3 Audit Trail Rules

- **Append-only:** Audit log accepts only new entries. No update or delete of existing entries.
- **Purpose:** Medicolegal and operational accountability (e.g. who finalised, when). Not for clinical care; not for patient-facing output.
- **Content:** Timestamp; facility; visit; doctor identifier; action type; entity type; optional non-PHI summary. Must never imply doctor negligence (CLINICAL_GUARDRAILS §8). Audit logs are not visible to patients and are not part of portability or routine sharing.
- **Access:** Restricted to authorised roles. Retention per facility and law.
- **Integrity:** The system must protect audit log from tampering (e.g. append-only store, access control). Corrections (if any) are documented in new entries, not by changing old ones.

---

## 5. External Sharing

### 5.1 Patient Consent

- **Rule:** The system must not share patient data with external parties (other facilities, insurers, family, or third parties) without the patient’s **explicit consent** or a clear **legal basis** (e.g. court order, mandatory reporting) (CLINICAL_GUARDRAILS §9).
- **Consent:** Consent should be obtained and recorded (e.g. purpose, recipient, scope, date). The facility is responsible for the consent process; the system must support recording consent where the facility implements it (e.g. consent flag, consent record).
- **Withdrawal:** If the patient withdraws consent for future sharing, the system and facility must respect that for future disclosures; past disclosures already made under consent are not recalled. Legal obligations (e.g. retention, mandatory disclosure) may still apply.

---

### 5.2 QR or File-Based Sharing

- **Patient-initiated:** The patient may receive an export (summary, visit-wise PDF, referral summary) as a **file** (e.g. PDF download) or **printable** document. The patient may then share that file or print with another clinician, facility, or insurer **at their own choice**. The system does not push data to external systems; sharing is by file or paper that the patient (or facility on request) carries or sends.
- **QR or link:** If the facility supports it, a QR code or secure link may be used to allow the patient (or receiving clinician) to **download** an export (e.g. referral summary, visit PDF) from the facility’s system. The link or QR leads to a one-time or time-limited download; no assumption of live, ongoing sync with external systems. Access to the link should be controlled (e.g. authentication, expiry) per facility policy.
- **No live syncing assumption:** The architecture does not assume that external systems (e.g. national health record, other hospital EMR) have live access to this system. Sharing is by **file, print, or controlled download**. If a facility later integrates with an external system, that integration must still respect consent and access control and should be documented separately.

---

### 5.3 No Cloud or National Health ID Assumptions

- **Cloud:** This document does not assume that data is stored in a particular cloud or region. Retention, backup, and storage location are facility and legal matters. Patient rights (access, portability, consent) apply regardless of where data is stored.
- **National health ID:** This document does not assume that the patient has a national health ID or that the system is connected to a national or regional health information exchange. Patient identification and portability are facility-scoped; exports are file-based or printable unless the facility implements a specific integration with consent and law.
- **Interoperability:** If the facility adopts a standard format for structured export (e.g. for referral or summary), that format can support future interoperability. This document does not mandate any such format; it requires that exports contain only doctor-finalised (and authorised) data and that sharing respects consent.

---

## 6. Summary: Patient Rights and System Obligations

| Area | Patient right / system obligation |
|------|-----------------------------------|
| **Access** | Patient may request access to their record (summary or visit-wise); system supports generation from authorised data only. |
| **Portability** | Patient may request downloadable summary, visit-wise export (PDF/structured), referral summary; exports are point-in-time, doctor-finalised only; no AI mention. |
| **Consent** | No external sharing without patient consent or legal basis; system must support consent recording where facility implements it. |
| **Sharing mechanism** | File-based or printable export; optional QR/link for download; no assumption of live syncing or national ID. |
| **Edit** | Demographics and longitudinal history editable per policy; draft visit data editable until finalise; finalised visit data restricted; corrections per facility policy. |
| **Immutability** | Finalised visit content locked for prescription/export; audit log append-only and immutable. |
| **Audit** | Audit for medicolegal and operational use; not visible to patients; never implies doctor negligence. |
| **Protection** | System protects integrity, access control, audit immutability, and no external sharing without consent or law. |

This document defines **patient rights** and **system obligations** for the OPD clinical system and is aligned with CLINICAL_GUARDRAILS, OPD_WORKFLOW, OPD_PRESCRIPTION_OUTPUT, and SYSTEM_ARCHITECTURE. It uses plain legal and clinical language and does not depend on cloud or national health ID.
