# System Architecture

This document defines the **system architecture** for the OPD clinical system. It is **non-negotiable** and establishes engineering limits. It follows **CLINICAL_GUARDRAILS**, **FACILITY_PROFILE**, **OPD_WORKFLOW**, **AI_CLINICAL_ENGINE**, and **OPD_PRESCRIPTION_OUTPUT**.

**Principles:**
- Doctor is final authority; system supports, never decides.
- AI suggests only; AI never writes clinical data or finalises.
- Patient output contains only doctor-approved content; no AI mention.
- Audit trail is silent, immutable, and never implies doctor negligence.
- No cloud vendor assumptions; design is deployment-agnostic.

---

## 1. Major System Components

The system is composed of four major components. Each has a clear responsibility; boundaries between them enforce the guardrails.

---

### 1.1 Frontend (Doctor UI)

**Purpose:** The interface used by the treating doctor to conduct an OPD visit: patient selection, data entry (complaints, vitals, examination, diagnosis, treatment, investigations, advice, disposition), review, finalise, and print.

**Responsibilities:**
- Render the OPD workflow (steps 1–10 per OPD_WORKFLOW).
- Capture and submit data entered by the doctor to the backend (never to the AI service for persistence).
- Request suggestions from the AI service when a trigger point is reached; display suggestions in a **collapsible, optional** area; never auto-apply suggestions to clinical fields.
- Display facility profile–driven lists (e.g. drugs, labs, imaging) for selection; doctor may also enter free text where allowed (e.g. drug name, diagnosis).
- Call the backend for finalise and for prescription data; call the print/export service with **only** doctor-finalised data.
- Enforce that progression to the next step is never blocked by the presence or absence of AI suggestions or by validation that could override doctor judgment.

**Does not:**
- Persist clinical data itself; all persistence is via the backend.
- Send patient data to the AI service for training or storage beyond the current request.
- Display AI attribution on any patient-facing output (prescription, slip).
- Allow the AI service to write directly to any clinical field or draft.

**Boundary:** The frontend is the only component with which the doctor interacts for clinical data entry and approval. It must never present AI output as final or patient-visible unless the doctor has explicitly approved it as their own.

---

### 1.2 Backend (Clinical Data and Audit)

**Purpose:** Authoritative store for all clinical data (facility, patient, visit, diagnoses, prescriptions, investigations, advice, disposition), facility profile, and audit log. Handles visit lifecycle, finalisation, and identity.

**Responsibilities:**
- Store and serve facility, patient, longitudinal record, and visit data.
- Store facility profile (facility_lab, facility_imaging, facility_drug, facility_clinical_facility) and serve it to the frontend and to the AI service (read-only for AI).
- Persist **draft** and **finalised** clinical data with explicit status; only data marked final by the doctor is used for prescription output and for “ordered” investigations.
- Record **audit log** entries: suggestion shown, doctor edit, finalise action, with timestamp, visit, doctor identity, entity type, and optional non-PHI payload; audit log is append-only and immutable (see Security).
- Enforce that **finalise** is an explicit action by the doctor: diagnoses, prescriptions, investigations, advice, and disposition are marked final only when the doctor triggers finalise; no automatic finalisation.
- Serve prescription/export payload: only finalised data, no suggestions, no AI attribution (per OPD_PRESCRIPTION_OUTPUT).
- Authenticate and authorise the doctor; provide doctor identity (name, registration number) for prescription and audit.

**Does not:**
- Invoke the AI service to write or update clinical data.
- Expose audit log to patients or to any channel that could imply negligence.
- Allow alteration or deletion of audit log entries after write.
- Infer or overwrite doctor intent (e.g. no auto-finalise, no auto-order).

**Boundary:** The backend is the single source of truth for clinical and facility data. The AI service has no write path into the backend; the frontend submits only doctor-originated or doctor-approved writes.

---

### 1.3 AI Service (Suggestion Engine)

**Purpose:** Generate **suggestions only** at defined trigger points (complaint entered, vitals entered/abnormal, examination added, diagnosis selected). Implements AI_CLINICAL_ENGINE behaviour: differential diagnosis, clinical prompts, investigations, treatment, advice, observation/referral—all advisory, facility-profile–bound, and never final.

**Responsibilities:**
- Receive **read-only** request payloads from the frontend (or backend on behalf of frontend): current visit context (complaint, vitals, examination, diagnoses—as entered so far), facility identifier, and trigger type.
- Load **facility profile** (labs, imaging, drugs, clinical facilities) from the backend or from a cache populated only from the backend; use it as the **only** source for suggestable orders (no suggestion of tests or drugs not in the profile).
- Return **suggestions** (e.g. structured tags, examination prompts, differential list, investigation suggestions, drug suggestions, advice snippets, observation/referral prompts) in advisory language; no final status, no patient-visible conclusion.
- Session-scoped and context-limited: process only the data in the request; do not retain patient data for training or for future requests beyond the session (CLINICAL_GUARDRAILS §9).
- Respond within a reasonable timeout; if unavailable or slow, the frontend must degrade gracefully (no block, no mandatory suggestion).

**Does not:**
- Write to the backend: no diagnosis, prescription, investigation order, advice, or disposition is written by the AI service.
- Persist patient data for model training or analytics.
- Receive or output data that would allow re-identification beyond the current request context if policy forbids it.
- Suggest any lab, imaging, or drug not in the facility profile; suggest observation/oxygen/IV only if present in facility_clinical_facility.
- Set any entity to “final” or “ordered”; only the doctor, via the frontend and backend, does that.

**Boundary:** The AI service is **read-only** with respect to clinical and facility data. It returns a suggestion payload; the frontend displays it; the doctor may ignore, edit, or accept; only the doctor’s actions result in backend writes.

---

### 1.4 Print / Export Service

**Purpose:** Produce the final OPD prescription (and optionally investigation slip or referral summary) from **doctor-finalised data only**, in the exact section order and content rules defined in OPD_PRESCRIPTION_OUTPUT.

**Responsibilities:**
- Receive a **finalised visit payload** from the backend (or frontend with data sourced only from backend after finalise): patient identification, visit date, doctor name and registration number, final diagnoses, final prescription lines, final investigations ordered, final advice, red flags, follow-up, referral/transfer summary if applicable.
- Assemble the document per OPD_PRESCRIPTION_OUTPUT: header, patient, date/doctor, diagnosis, medicines, investigations, advice, red flags, follow-up, referral (if any), medicolegal statements, space for signature and date.
- Omit any suggestion, draft, or AI-attributed content; no “suggested” or “AI” section; no internal IDs on the patient copy unless facility policy explicitly requires a minimal identifier.
- Output printable (e.g. PDF) and optionally other formats (e.g. electronic prescription); same content rules apply.
- Support signature: space for wet or legally acceptable electronic signature and date of issue.

**Does not:**
- Accept or include non-finalised data in the prescription.
- Mention AI, assistant, or decision-support on the output.
- Add content not approved by the doctor.

**Boundary:** The print/export service is a pure function of doctor-finalised data. It has no direct link to the AI service for prescription content; its input is only the finalised visit payload from the backend.

---

## 2. Data Boundaries

### 2.1 What the AI Service Can Read

The AI service may receive, for the **current request only** and for the **current visit/session**:

- **Facility identifier** (so it can load the correct facility profile).
- **Facility profile** (read-only): facility_lab, facility_imaging, facility_drug, facility_clinical_facility. Source: backend only. Used to constrain suggestions to available tests, drugs, and clinical facilities.
- **Visit context (current state at trigger time):**
  - Chief complaint (free text and structured tags).
  - Vitals as entered (no historical vitals beyond what is in the visit).
  - Examination findings as entered (structured and/or free text).
  - Visit-level diagnoses as entered (provisional or final—for context only; AI does not set final).
  - Optionally: patient age/weight for dose-range suggestions; no other longitudinal patient data unless explicitly required for a minimal suggestion (e.g. chronic list summary); must be session-scoped and not retained for training.

**Scope:** Session-scoped and context-limited (CLINICAL_GUARDRAILS §9). No bulk export of patient data to the AI service; no use of patient data for model training.

---

### 2.2 What the AI Service Must Never Write

The AI service **must not** write, update, or finalise:

- **Diagnoses** (visit-level or chronic).
- **Prescription lines** (drug, dose, frequency, duration, instructions).
- **Investigation orders** (lab or imaging).
- **Advice** (diet, fluids, home care, red flags).
- **Disposition** (observation, referral).
- **Finalise flags** on any entity (e.g. is_final, finalized_at, finalized_by).
- **Audit log** (audit is written by the backend based on doctor and system actions, not by the AI service).
- **Facility profile** or any master data.
- **Patient or visit** records.

**Enforcement:** The system must not expose any API or channel that allows the AI service to persist or update clinical data in the backend. All writes to clinical and audit data originate from the frontend/backend as a result of **doctor actions**.

---

### 2.3 Doctor-Finalised vs Draft Data

- **Draft data:** Data entered or selected by the doctor but not yet marked final. Shown in the UI; may be edited or removed; **never** included in the prescription or in “ordered” investigations. Stored with status indicating draft (e.g. is_final = false, or equivalent).
- **Finalised data:** Data that the doctor has explicitly confirmed at **finalise** (workflow step 10). Stored with status indicating final (e.g. is_final = true, finalized_at, finalized_by). Only finalised diagnoses, prescription lines, investigation orders, advice, red flags, follow-up, and referral summary are sent to the print/export service and appear on the prescription.
- **Suggestions:** Generated by the AI service; displayed in a separate, collapsible area. They are **not** stored as clinical data unless the doctor adds or edits and then saves/finalises. Suggestions are not part of draft or finalised clinical records; they may be logged in the audit for medicolegal context (e.g. “suggestion shown”), but they are never written as diagnosis, prescription, or order by the AI.

**Rule:** The backend must distinguish draft from finalised state for every clinical entity that can appear on the prescription. The prescription payload contains only finalised entities.

---

## 3. API Contracts (Conceptual)

The following are **conceptual** contracts between components. They define behaviour and data flow, not protocol or syntax.

---

### 3.1 Visit Lifecycle

- **Create visit:** Frontend requests new visit (patient, facility, doctor). Backend creates visit in draft state, returns visit identifier. No AI involvement.
- **Update visit (draft):** Frontend submits doctor-entered data (complaints, vitals, examination, diagnoses, prescriptions, investigations, advice, disposition). Backend stores as draft; may record “edit” in audit with doctor identity and entity. No AI write.
- **Finalise visit:** Frontend requests finalise for a given visit. Backend marks all clinical entities selected for finalise as final (diagnoses, prescription lines, investigation orders, advice, disposition); records finalise in audit with timestamp and doctor identity. No AI involvement. After finalise, prescription payload is available.
- **Print/export:** Frontend or backend requests prescription (and optional investigation slip) for a finalised visit. Backend (or frontend with backend data) sends **only finalised** payload to print/export service. Print/export service returns document; no AI involvement.

**Rule:** Visit moves from draft to finalised only on explicit doctor finalise action. No time-based or automatic finalisation.

---

### 3.2 Suggestions vs Finalised Actions

- **Request suggestions:** Frontend sends a request to the AI service when a trigger fires (complaint entered, vitals entered/abnormal, examination added, diagnosis selected). Request includes: facility identifier, trigger type, current visit context (complaint, vitals, examination, diagnoses as entered). No patient identifier or visit identifier is required in the request beyond what is needed to fetch context; minimise to what is necessary.
- **Response:** AI service returns a suggestion payload (e.g. tags, prompts, differential list, investigation suggestions, drug suggestions, advice snippets, observation/referral prompts). Payload is **advisory only**; no status such as “final” or “ordered”.
- **Display:** Frontend shows suggestions in a collapsible area; doctor may ignore, edit, or accept. **Accept** means the doctor adds or edits clinical data in the UI and saves; that save is a **doctor-originated write** to the backend, not an AI write. Suggestions are never auto-applied to draft or finalised storage.
- **Order / finalise:** “Order” (e.g. promote investigation from suggested to ordered) and “finalise” are **only** doctor actions. Backend records them with doctor identity; audit log records the action. AI never calls an “order” or “finalise” endpoint.

**Rule:** There is no API that allows the AI service to create or update clinical or audit records. Suggestion response is consumed only by the frontend for display.

---

### 3.3 Audit Logging

- **Who writes:** Backend (or a dedicated audit component that receives events from the backend) writes all audit log entries. AI service does not write to the audit log.
- **When:** On defined events, e.g.: suggestion shown (visit, trigger, optional non-PHI summary); doctor edit (visit, entity type, optional summary); finalise (visit, doctor, timestamp). Payload must be non-PHI or minimal; no full clinical text in log if policy forbids it.
- **What is stored:** Timestamp, facility, visit identifier, doctor identifier, action type (e.g. suggestion_shown, edit, finalise), entity type (e.g. diagnosis, prescription, investigation_order), optional entity identifier, optional JSON summary. Audit must never imply doctor negligence (CLINICAL_GUARDRAILS §8).
- **Immutability:** Audit log is append-only. No update or delete of existing entries. Retention per facility/jurisdiction policy.
- **Access:** Audit log is not exposed to patients. Access is restricted to authorised roles (e.g. facility admin, medicolegal review) and must be logged.

**Rule:** Audit is the only place where “suggestion shown” may be recorded; it is for medicolegal context only and must not be used to blame the doctor for ignoring a suggestion.

---

## 4. Security and Medicolegal Protections

### 4.1 Audit Immutability

- Audit log entries, once written, **must not** be altered or deleted by any component or user. Append-only storage and access control enforce this.
- If correction is required (e.g. wrong doctor ID), the only acceptable approach is a **new corrective entry** that references the original; the original entry remains unchanged. Local policy may define when this is allowed and by whom.

---

### 4.2 Doctor Identity and Signature

- **Authentication:** The doctor is authenticated before starting or continuing a visit. The backend associates every draft update and every finalise action with the authenticated doctor identity.
- **Identity on prescription:** The prescription shows the treating doctor’s name and, if applicable, registration number (as configured and consented). The backend supplies this from the doctor master data linked to the authenticated identity.
- **Signature:** The prescription includes space for the doctor’s signature and date of issue. Signature may be wet (printed document) or electronic (if legally acceptable in the jurisdiction). The system must not generate or forge the doctor’s signature; it only provides the field and the finalised content the doctor attests to.

**Rule:** Every finalise and every prescription is tied to a single, authenticated doctor identity. No shared or system “doctor” for clinical finalisation.

---

### 4.3 Patient Data Isolation

- **Per facility:** Patient and visit data are scoped by facility. A doctor (or process) may access only data for facilities they are authorised for. No cross-facility access unless explicitly authorised (e.g. central admin role).
- **Per visit:** AI service receives only the visit context necessary for the current suggestion request; no bulk patient history beyond what is in the current visit or minimal longitudinal summary (e.g. chronic list) if needed for suggestion logic. Patient data must not be used to train models or be retained by the AI service beyond the request (CLINICAL_GUARDRAILS §9).
- **Export and sharing:** No external sharing of patient data without explicit consent and policy-compliant mechanism. Print/export produces documents for the patient and facility; distribution of those documents is governed by facility and consent, not by the system defaulting to share.

---

## 5. Failure Modes

The system must behave safely when components fail or data is partial. The following are **non-negotiable** behaviours.

---

### 5.1 AI Service Unavailable

- **Behaviour:** If the AI service is down, slow, or times out, the frontend must **not** block the doctor. The doctor can complete every step of the workflow (complaints, vitals, examination, diagnosis, treatment, investigations, advice, disposition, finalise, print) without any suggestion.
- **Display:** The suggestion area may show a neutral message (e.g. “Suggestions temporarily unavailable”) or remain empty. No error that implies the doctor must wait or retry for clinical workflow to proceed.
- **Data:** No clinical data is lost. All data is stored in the backend on doctor save; AI unavailability does not prevent save or finalise.
- **Rule:** The system must be fully usable with the AI service entirely absent. Doctor judgment and workflow never depend on AI availability.

---

### 5.2 Partial Data

- **Missing vitals or examination:** Workflow does not require vitals or examination to proceed. Doctor can leave fields blank and move to the next step. AI may have less context for suggestions; that is acceptable. No hard validation that blocks progression.
- **Missing diagnosis:** Doctor can finalise a visit without a diagnosis (e.g. “Undifferentiated fever” or “To be assessed”). Prescription may show “—” or facility-defined placeholder for diagnosis section; advice and red flags may still be finalised.
- **Missing prescription or investigations:** Doctor can finalise with no medicines or no investigations. Prescription shows empty list or “None” as appropriate; print/export still produces a valid prescription with attestation and signature.
- **Rule:** No step except disposition (and finalise for print) is mandatory. Partial data must not cause system error or data loss; backend must accept and store partial drafts and partial finalised state.

---

### 5.3 Facility Mismatch

- **Wrong facility profile:** If the visit is associated with facility A but the AI service or frontend erroneously loads facility B’s profile, suggestions could include tests or drugs not available at A. **Mitigation:** Backend must supply facility identifier with the visit; frontend and AI service must use that same identifier to load facility profile. No suggestion should be generated for tests/drugs/facilities that are not in the **visit’s facility** profile.
- **Profile out of date:** If facility profile is updated (e.g. a drug removed) after a visit has started but before finalise, the doctor may have already added that drug in draft. **Behaviour:** Draft data is not automatically invalidated. At finalise, facility profile may be used to warn (“Drug X not in current facility list”) only if policy allows; the doctor may still finalise (doctor judgment wins). Prescription prints what the doctor finalised.
- **Rule:** Suggestion engine must always use the facility profile for the **current visit’s facility**. Backend must not allow finalising a visit against a different facility than the one the visit was created under.

---

## 6. Summary: Engineering Limits

| Area | Limit |
|------|--------|
| **AI write** | AI service must never write clinical data, finalise flags, or audit entries. |
| **Finalise** | Only explicit doctor action marks data as final; no auto-finalise. |
| **Prescription** | Only doctor-finalised data; no AI mention; no suggested content. |
| **Facility profile** | AI suggests only from the visit’s facility profile; no inference from facility type. |
| **Audit** | Append-only, immutable; written by backend; never implies doctor negligence. |
| **AI unavailable** | Full workflow and finalise/print must work without AI. |
| **Partial data** | Draft and finalise accepted with optional fields empty; no block. |
| **Identity** | Every finalise and prescription tied to authenticated doctor; signature by doctor only. |
| **Patient data** | Session-scoped for AI; no training use; isolation by facility and visit. |

This document defines the system architecture and engineering limits for the OPD clinical system and is **non-negotiable**.
