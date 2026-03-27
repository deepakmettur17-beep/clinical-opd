# Facility Profile System

This document defines the **Facility Profile** for the clinical OPD application. It is aligned with **CLINICAL_GUARDRAILS** (§4 Facility-Aware Intelligence, §10 Design Philosophy).

The facility profile is configured **once per clinic or hospital**. AI suggestions **must read only from this profile**. If a test or drug is unavailable, AI **must not** suggest it as an order. If critical tests are unavailable, AI may suggest observation or referral.

---

## 1. Data Model

### 1.1 Overview

The facility profile consists of one **facility** record and four catalog tables that define what is **available at that site**. Each catalog is a list of items the facility can provide or perform. No item outside these lists may be suggested by AI as an order.

| Table | Purpose |
|-------|--------|
| **facility** | The clinic or hospital; one row per site. |
| **facility_lab** | Lab tests the facility can perform or send (in-house or tie-up). |
| **facility_imaging** | Imaging modalities available (ECG, X-ray, USG, CT, MRI, etc.). |
| **facility_drug** | Drugs available for prescribing (OPD and/or emergency). |
| **facility_clinical_facility** | Clinical facilities and capabilities (beds, oxygen, IV, nebulization, etc.). (In the SQL schema this may be implemented as `facility_service` with category = clinical_facility.) |

---

### 1.2 Facility (root)

Single record per physical site.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key. |
| name | Text | Facility name (e.g. "City Clinic", "Sunrise Nursing Home"). |
| type | Text | **clinic** \| **nursing_home** \| **hospital**. Drives expectations of capability. |
| address | Text | Optional address. |
| created_at | Timestamp | When the record was created. |

---

### 1.3 Facility Lab (available lab tests)

One row per **lab test** the facility can offer. AI must not suggest as an order any test that does not appear here.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key. |
| facility_id | UUID | References facility. |
| code | Text | Internal or standard code (e.g. "CBC", "RBS", "LFT"). Unique per facility. |
| name | Text | Display name (e.g. "Complete Blood Count", "Random Blood Sugar"). |
| specimen | Text | Optional (e.g. "Blood", "Urine", "Serum"). |
| created_at | Timestamp | When the record was created. |

---

### 1.4 Facility Imaging (available imaging)

One row per **imaging modality or study** the facility can perform. AI must not suggest as an order any imaging not listed here.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key. |
| facility_id | UUID | References facility. |
| code | Text | Internal or standard code (e.g. "ECG", "XRAY_CHEST", "USG_ABD"). Unique per facility. |
| name | Text | Display name (e.g. "ECG", "X-ray Chest", "Ultrasound Abdomen"). |
| modality | Text | **ECG** \| **X-ray** \| **USG** \| **CT** \| **MRI** \| **Echo** \| other. |
| created_at | Timestamp | When the record was created. |

---

### 1.5 Facility Drug (available drugs — OPD + emergency)

One row per **drug** the facility stocks and allows to be prescribed. AI must not suggest as a prescription any drug that does not appear here. Supports both OPD and emergency use.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key. |
| facility_id | UUID | References facility. |
| code | Text | Internal or standard code (e.g. "PARA_500", "AMOX_500"). Unique per facility. |
| name | Text | Display name (e.g. "Paracetamol", "Amoxicillin"). |
| form | Text | Tablet, capsule, syrup, injection, suspension, cream, etc. |
| strength | Text | e.g. "500 mg", "250 mg/5 ml". |
| use_context | Text | **opd** \| **emergency** \| **both**. OPD = routine prescriptions; emergency = crash cart / acute care. |
| created_at | Timestamp | When the record was created. |

---

### 1.6 Facility Clinical Facility (available clinical facilities)

One row per **clinical capability** the facility has (beds, oxygen, IV, nebulization, etc.). Used so AI does not suggest observation, oxygen, IV, or procedures the facility cannot provide.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key. |
| facility_id | UUID | References facility. |
| code | Text | Internal code (e.g. "OBS_BED", "O2", "IV_LINE", "NEBULIZATION"). Unique per facility. |
| name | Text | Display name (e.g. "Observation bed", "Oxygen", "IV line", "Nebulization"). |
| category | Text | **observation** \| **respiratory_support** \| **iv_fluids** \| **procedure** \| **other**. |
| created_at | Timestamp | When the record was created. |

**Typical clinical facilities to model:**

- Observation bed (short-stay observation)
- Oxygen (cylinder/concentrator)
- IV line / IV fluids
- Nebulization
- ECG at bedside
- Dressing / minor procedure room
- Injection room
- Others as per facility

---

## 2. Example Facility Profiles

The following are **example** configurations. Actual profiles are defined by the facility; the system must adapt to reality (§10).

---

### 2.1 Small Clinic

**Facility:** type = **clinic**, single-doctor or small team, no in-house lab or imaging.

| Catalog | Example entries |
|---------|------------------|
| **Lab** | RBS (finger-prick), Hb (strip/cuvette), Urine routine (dipstick), maybe basic send-out (e.g. CBC, sugar, creatinine via external lab). |
| **Imaging** | ECG only (if machine available); otherwise none. |
| **Drugs (OPD)** | Paracetamol, ibuprofen, amoxicillin, metformin, omeprazole, cetirizine, ORS, topical antiseptic, basic antacids, antihypertensives (e.g. amlodipine), antidiabetic (metformin, gliclazide). **use_context** = opd. |
| **Drugs (emergency)** | Adrenaline, antihistamine injection, dexamethasone, salbutamol inhaler/nebulization solution if nebulizer available. **use_context** = emergency or both. |
| **Clinical facilities** | Nebulization (if machine available); injection room; dressing. No observation bed, no oxygen, no IV if not available. |

**Intent:** AI suggests only the tests and drugs in this list. If CBC or X-ray is not in the profile, AI does **not** suggest them as orders; it may suggest clinical examination, observation if safe, or referral.

---

### 2.2 Nursing Home

**Facility:** type = **nursing_home**, 24-hour nursing, some in-house capability, limited imaging.

| Catalog | Example entries |
|---------|------------------|
| **Lab** | RBS, Hb, urine routine, CBC, blood sugar (fasting/PP), creatinine, electrolytes, LFT, basic culture if tie-up. |
| **Imaging** | ECG, X-ray (chest, limb if portable or tie-up), possibly bedside USG if available. |
| **Drugs (OPD)** | Full common OPD list: analgesics, antibiotics, antidiabetics, antihypertensives, GI, respiratory, topical, vitamins. **use_context** = opd. |
| **Drugs (emergency)** | Adrenaline, atropine, antihistamine injection, dexamethasone, hydrocortisone, salbutamol/nebulization, furosemide, morphine/pethidine if permitted, anticonvulsant (e.g. diazepam), antiemetic injection. **use_context** = emergency or both. |
| **Clinical facilities** | Observation bed, oxygen (cylinder/concentrator), IV line/IV fluids, nebulization, ECG at bedside, dressing, injection room. |

**Intent:** AI can suggest observation, oxygen, IV, and nebulization because they are in the profile. It still suggests only listed labs, imaging, and drugs.

---

### 2.3 Tertiary Hospital

**Facility:** type = **hospital**, full diagnostics and treatment capability.

| Catalog | Example entries |
|---------|------------------|
| **Lab** | Full panel: CBC, coagulation, biochemistry (sugar, renal, LFT, electrolytes, lipids), cardiac markers, ABG, urine/stool/culture, CSF, fluid analysis, special tests as offered. |
| **Imaging** | ECG, X-ray (all common views), USG (abdomen, pelvis, soft tissue, etc.), CT (head, chest, abdomen, etc.), MRI, Echo, other modalities as available. |
| **Drugs (OPD)** | Comprehensive formulary for OPD. **use_context** = opd. |
| **Drugs (emergency)** | Full emergency/critical care list: resuscitation, vasopressors, antiarrhythmics, anticoagulants, antibiotics, sedatives, analgesics, etc. **use_context** = emergency or both. |
| **Clinical facilities** | Observation bed, oxygen, IV line, nebulization, ECG, dressing, injection, procedure room, and any other capabilities the hospital defines. |

**Intent:** AI can suggest from the full profile. The profile is still the single source of truth; nothing is suggested that is not listed.

---

## 3. Rules for How AI Uses the Facility Profile Safely

These rules are **mandatory** for any AI or decision-support logic that uses the facility profile. They implement CLINICAL_GUARDRAILS §4 and §6.

### 3.1 Single source of truth

- The **facility profile** (facility_lab, facility_imaging, facility_drug, facility_clinical_facility) is the **only** source from which AI may derive "what can be ordered or done at this facility."
- AI must **read only** from this profile when suggesting orders (labs, imaging, drugs) or use of clinical facilities (observation, oxygen, IV, nebulization, etc.).
- No hardcoded or external list may override the facility profile for the purpose of suggesting orders.

### 3.2 Do not suggest unavailable resources as orders

- **Lab:** If a lab test is **not** present in **facility_lab** for the current facility, AI **must not** suggest it as an order.
- **Imaging:** If an imaging study or modality is **not** present in **facility_imaging**, AI **must not** suggest it as an order.
- **Drugs:** If a drug is **not** present in **facility_drug**, AI **must not** suggest it as a prescription. For acute/emergency suggestions, only drugs with **use_context** = emergency or **both** may be suggested in that context.
- **Clinical facilities:** If a capability (e.g. observation bed, oxygen, IV, nebulization) is **not** in **facility_clinical_facility**, AI **must not** suggest that the facility can provide it as part of the plan.

### 3.3 When the ideal test or treatment is unavailable

When a clinically ideal test or treatment is **not** in the facility profile:

1. **Suggest relevant clinical examination** where it can help (e.g. physical signs, vital signs, bedside tests already available).
2. **Suggest observation** only if:
   - The facility has **observation** (or equivalent) in **facility_clinical_facility**, and
   - It is clinically reasonable and safe to observe at this facility.
3. **Suggest referral** if clinically appropriate (e.g. when a critical test or treatment is unavailable and cannot be safely replaced by examination or observation at this facility).

Language must remain advisory (§5): e.g. "Consider referral if…", "Observation may be considered if…", "If clinically indicated, may be evaluated at a centre with…".

### 3.4 Clinical facilities and observation/referral

- Before suggesting **observation**, AI must confirm that the facility profile includes the relevant capability (e.g. observation bed, monitoring, oxygen if needed).
- Before suggesting that the facility can provide **oxygen**, **IV fluids**, or **nebulization**, AI must confirm these appear in **facility_clinical_facility**.
- If critical support (e.g. oxygen, IV, monitoring) is not in the profile, AI must **not** state that the facility can provide it; it may suggest referral to a facility that can.

### 3.5 Doctor remains final authority

- All of the above governs **suggestions** only. The **doctor** may order any test or drug they choose; the system may allow free-text or off-profile orders to be entered and finalized by the doctor.
- The facility profile **restricts AI suggestions**, not the doctor’s ability to document or finalize clinical decisions.
- If the doctor orders something not in the profile, the system does **not** treat this as a warning, penalty, or negative log (§2).

### 3.6 No inference beyond the profile

- AI must **not** infer that a facility has a capability because of its **type** (clinic, nursing_home, hospital). For example, it must not assume "all hospitals have CT" unless CT is present in **facility_imaging** for that facility.
- Only **explicit entries** in the facility profile define what AI may suggest.

---

## Summary

| Aspect | Rule |
|--------|------|
| **Configuration** | One facility profile per clinic/hospital; configured once per site. |
| **AI input** | AI reads **only** from the facility profile for suggesting orders and use of clinical facilities. |
| **Unavailable test/drug** | AI **must not** suggest it as an order. |
| **Unavailable critical test** | AI may suggest clinical examination, observation (if in profile and safe), or referral. |
| **Clinical facilities** | Observation, oxygen, IV, nebulization, etc. are suggested only if present in **facility_clinical_facility**. |
| **Doctor** | Doctor can order or document anything; profile limits **suggestions**, not doctor authority. |

This design ensures facility-aware, safe AI behavior in small clinics, nursing homes, and tertiary hospitals, in line with CLINICAL_GUARDRAILS.
