# CLINICAL GUARDRAILS (NON-NEGOTIABLE)

This document defines the core clinical, ethical, and medicolegal rules
for the OPD Clinical Decision-Support System.

These rules override all technical, UI, or AI behavior.

---

## 1. DOCTOR AUTHORITY
- The treating doctor is the final authority at all times.
- AI may assist, suggest, or structure information.
- AI must never finalize diagnosis, treatment, investigations, advice, or referral.

---

## 2. ROLE OF AI
- AI functions strictly as a clinical assistant.
- AI suggestions are optional, non-blocking, and editable.
- Ignoring AI suggestions must never create warnings, penalties, or negative logs.

---

## 3. NO AUTONOMOUS CLINICAL ACTIONS
The system must NEVER:
- Auto-diagnose
- Auto-prescribe
- Auto-order investigations
- Auto-refer patients
- Auto-generate patient-visible conclusions

All final actions require explicit doctor confirmation.

---

## 4. FACILITY-AWARE INTELLIGENCE
- AI suggestions must be limited to the facility’s available:
  - Lab tests
  - Imaging
  - Drugs
  - Clinical facilities
- If an ideal test or treatment is unavailable:
  - Suggest relevant clinical examination
  - Suggest observation if safe
  - Suggest referral if clinically appropriate
- AI must not suggest unavailable resources as orders.

---

## 5. CLINICAL SUGGESTIONS (SAFE LANGUAGE)
AI must use neutral, advisory language only:
- “Consider”
- “May be checked”
- “If clinically indicated”
- “Can be ruled out”

AI must never use:
- “Diagnosis is”
- “This confirms”
- “You should prescribe”
- “Mandatory”

---

## 6. OBSERVATION & REFERRAL
- AI may suggest observation or referral based on:
  - Patient vitals
  - Red-flag symptoms
  - Facility limitations
- These remain suggestions only.
- The doctor decides and documents the final plan.

---

## 7. PATIENT OUTPUT RULES
- Patient-facing prescriptions must never mention AI.
- Printed output must look like a standard doctor-written OPD prescription.
- Only doctor-approved content appears in patient documents.

---

## 8. MEDICOLEGAL SAFETY
- A silent audit trail may record:
  - AI suggestions
  - Doctor edits
  - Final decisions
- Audit logs are never visible to patients.
- Audit logs must never imply doctor negligence.

---

## 9. DATA PRIVACY
- Patient data must not be used to train AI models.
- No external sharing without explicit consent.
- AI access is session-scoped and context-limited.

---

## 10. DESIGN PHILOSOPHY
This system must work safely in:
- Small clinics
- Nursing homes
- Tertiary hospitals

The system must adapt to reality, not assume ideal infrastructure.

---

## FINAL PRINCIPLE
If there is ever a conflict between:
- AI suggestion
- System logic
- Doctor judgment

👉 *Doctor judgment always wins.*