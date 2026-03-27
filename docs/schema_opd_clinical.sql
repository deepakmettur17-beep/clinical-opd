-- =============================================================================
-- OPD CLINICAL DATABASE SCHEMA
-- Doctor-controlled, longitudinal patient records. No billing/insurance.
-- No AI decision tables. Doctor-finalized data only is marked final.
-- Silent audit logs for medicolegal safety.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- FACILITY PROFILE
-- Defines what labs, imaging, drugs, and clinical facilities are available
-- at this site. AI suggestions must be limited to these (CLINICAL_GUARDRAILS §4).
-- -----------------------------------------------------------------------------

CREATE TABLE facility (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,  -- e.g. 'clinic', 'nursing_home', 'hospital'
    address         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name)
);

COMMENT ON TABLE facility IS 'Healthcare facility where OPD is conducted. One schema can serve multiple facilities.';

CREATE TABLE facility_lab (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id     UUID NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    specimen        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (facility_id, code)
);

COMMENT ON TABLE facility_lab IS 'Lab tests available at this facility. AI must not suggest tests not listed here.';

CREATE TABLE facility_imaging (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id     UUID NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    modality        TEXT,  -- e.g. X-ray, USG, CT, MRI
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (facility_id, code)
);

COMMENT ON TABLE facility_imaging IS 'Imaging studies available at this facility.';

CREATE TABLE facility_drug (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id     UUID NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    form            TEXT,   -- tablet, syrup, injection, etc.
    strength        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (facility_id, code)
);

COMMENT ON TABLE facility_drug IS 'Drugs available at this facility. Prescriptions should reference these where applicable.';

CREATE TABLE facility_service (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id     UUID NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    category        TEXT,  -- e.g. procedure, referral_specialty, bed_type
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (facility_id, code)
);

COMMENT ON TABLE facility_service IS 'Other clinical facilities/services (procedures, referral options, etc.).';

-- -----------------------------------------------------------------------------
-- STAFF & DOCTOR
-- Treating doctor is the final authority (CLINICAL_GUARDRAILS §1).
-- -----------------------------------------------------------------------------

CREATE TABLE doctor (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id     UUID NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
    external_id     TEXT,
    full_name       TEXT NOT NULL,
    qualification   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (facility_id, external_id)
);

COMMENT ON TABLE doctor IS 'Treating doctors. All final clinical actions are attributed to a doctor.';

-- -----------------------------------------------------------------------------
-- LONGITUDINAL PATIENT RECORD (LIFETIME)
-- One record per patient; visits link to this.
-- -----------------------------------------------------------------------------

CREATE TABLE patient (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id     UUID NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
    external_id     TEXT,
    full_name       TEXT NOT NULL,
    date_of_birth   DATE,
    sex             TEXT,
    contact         TEXT,
    address         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (facility_id, external_id)
);

COMMENT ON TABLE patient IS 'Longitudinal patient record. One row per patient per facility; visits link here.';

CREATE INDEX idx_patient_facility ON patient(facility_id);
CREATE INDEX idx_patient_external ON patient(facility_id, external_id);

-- -----------------------------------------------------------------------------
-- VISIT-BASED OPD RECORDS
-- Each OPD encounter is one visit. All clinical data is visit-scoped unless
-- explicitly longitudinal (e.g. chronic problem list).
-- -----------------------------------------------------------------------------

CREATE TABLE visit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id     UUID NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
    patient_id      UUID NOT NULL REFERENCES patient(id) ON DELETE RESTRICT,
    doctor_id       UUID NOT NULL REFERENCES doctor(id) ON DELETE RESTRICT,
    visit_number    INT NOT NULL,
    visit_date      DATE NOT NULL,
    visit_type      TEXT,  -- e.g. new, follow_up, referral_in
    chief_complaint TEXT,
    status          TEXT NOT NULL DEFAULT 'open',  -- open, closed
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (patient_id, visit_number)
);

COMMENT ON TABLE visit IS 'Single OPD encounter. All visit-level clinical data references this.';

CREATE INDEX idx_visit_patient ON visit(patient_id);
CREATE INDEX idx_visit_facility_date ON visit(facility_id, visit_date);
CREATE INDEX idx_visit_doctor ON visit(doctor_id);

-- -----------------------------------------------------------------------------
-- CLINICAL FINDINGS (STRUCTURED + FREE TEXT)
-- Doctor-entered only. No auto-finalization.
-- -----------------------------------------------------------------------------

CREATE TABLE clinical_finding (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES visit(id) ON DELETE CASCADE,
    finding_type    TEXT NOT NULL,  -- e.g. vitals, examination, history
    name_or_code    TEXT,
    value_text      TEXT,
    value_numeric   NUMERIC,
    value_unit      TEXT,
    free_text       TEXT,
    is_final        BOOLEAN NOT NULL DEFAULT false,
    finalized_at    TIMESTAMPTZ,
    finalized_by_id UUID REFERENCES doctor(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id   UUID REFERENCES doctor(id)
);

COMMENT ON TABLE clinical_finding IS 'Structured and free-text findings (vitals, exam, history). is_final only when doctor explicitly finalizes.';

CREATE INDEX idx_clinical_finding_visit ON clinical_finding(visit_id);

-- -----------------------------------------------------------------------------
-- DIAGNOSES
-- Visit-level diagnoses and longitudinal chronic problem list.
-- -----------------------------------------------------------------------------

CREATE TABLE diagnosis (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID REFERENCES visit(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
    code            TEXT,
    term            TEXT NOT NULL,
    type            TEXT NOT NULL,  -- visit_diagnosis, chronic_problem
    is_primary      BOOLEAN DEFAULT false,
    is_final        BOOLEAN NOT NULL DEFAULT false,
    finalized_at    TIMESTAMPTZ,
    finalized_by_id UUID REFERENCES doctor(id),
    resolved_at     TIMESTAMPTZ,  -- for chronic problems when resolved
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id   UUID REFERENCES doctor(id),
    CONSTRAINT chk_diagnosis_visit_or_chronic CHECK (
        (type = 'visit_diagnosis' AND visit_id IS NOT NULL) OR
        (type = 'chronic_problem' AND visit_id IS NULL)
    )
);

COMMENT ON TABLE diagnosis IS 'Visit-level diagnoses and chronic problem list. Only doctor-finalized rows are considered final.';

CREATE INDEX idx_diagnosis_visit ON diagnosis(visit_id);
CREATE INDEX idx_diagnosis_patient ON diagnosis(patient_id);

-- -----------------------------------------------------------------------------
-- PRESCRIPTIONS (DOCTOR-FINALIZED ONLY)
-- No auto-prescribe (CLINICAL_GUARDRAILS §3). Patient-visible output is
-- doctor-approved only (§7).
-- -----------------------------------------------------------------------------

CREATE TABLE prescription (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES visit(id) ON DELETE CASCADE,
    facility_drug_id UUID REFERENCES facility_drug(id) ON DELETE SET NULL,
    drug_name       TEXT NOT NULL,  -- as written (may be generic or brand)
    form            TEXT,
    strength        TEXT,
    dose            TEXT NOT NULL,
    route           TEXT,
    frequency       TEXT,
    duration        TEXT,
    instructions    TEXT,
    is_final        BOOLEAN NOT NULL DEFAULT false,
    finalized_at    TIMESTAMPTZ,
    finalized_by_id UUID REFERENCES doctor(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id   UUID REFERENCES doctor(id)
);

COMMENT ON TABLE prescription IS 'Medicines prescribed. Only is_final = true rows appear on patient-visible prescription.';

CREATE INDEX idx_prescription_visit ON prescription(visit_id);

-- -----------------------------------------------------------------------------
-- INVESTIGATIONS ORDERED
-- Lab and imaging orders. Doctor-finalized only; no auto-order (§3).
-- -----------------------------------------------------------------------------

CREATE TABLE investigation_order (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES visit(id) ON DELETE CASCADE,
    order_type      TEXT NOT NULL,  -- lab, imaging
    facility_lab_id     UUID REFERENCES facility_lab(id) ON DELETE SET NULL,
    facility_imaging_id UUID REFERENCES facility_imaging(id) ON DELETE SET NULL,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    clinical_notes  TEXT,
    is_final        BOOLEAN NOT NULL DEFAULT false,
    finalized_at    TIMESTAMPTZ,
    finalized_by_id UUID REFERENCES doctor(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id   UUID REFERENCES doctor(id),
    CONSTRAINT chk_investigation_ref CHECK (
        (order_type = 'lab'     AND facility_imaging_id IS NULL) OR
        (order_type = 'imaging' AND facility_lab_id IS NULL)
    )
);

COMMENT ON TABLE investigation_order IS 'Lab/imaging orders. Finalized by doctor only. Should reference facility-available tests (§4).';

CREATE INDEX idx_investigation_order_visit ON investigation_order(visit_id);

-- -----------------------------------------------------------------------------
-- ADVICE AND FOLLOW-UP
-- Doctor-documented advice and follow-up plan.
-- -----------------------------------------------------------------------------

CREATE TABLE advice (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES visit(id) ON DELETE CASCADE,
    advice_type     TEXT NOT NULL,  -- general_advice, diet, lifestyle, referral_advice
    content         TEXT NOT NULL,
    is_final        BOOLEAN NOT NULL DEFAULT false,
    finalized_at    TIMESTAMPTZ,
    finalized_by_id UUID REFERENCES doctor(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id   UUID REFERENCES doctor(id)
);

COMMENT ON TABLE advice IS 'Clinical advice given to patient. Only finalized rows appear on patient output.';

CREATE TABLE follow_up (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES visit(id) ON DELETE CASCADE,
    follow_up_date  DATE,
    follow_up_notes TEXT,
    is_final        BOOLEAN NOT NULL DEFAULT false,
    finalized_at    TIMESTAMPTZ,
    finalized_by_id UUID REFERENCES doctor(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id   UUID REFERENCES doctor(id)
);

COMMENT ON TABLE follow_up IS 'Follow-up plan. Doctor-finalized only.';

CREATE INDEX idx_advice_visit ON advice(visit_id);
CREATE INDEX idx_follow_up_visit ON follow_up(visit_id);

-- -----------------------------------------------------------------------------
-- SILENT AUDIT LOG (MEDICOLEGAL SAFETY)
-- Records suggestions, edits, final decisions. Never implies negligence (§8).
-- Not visible to patients. No AI decision tables—only event log.
-- -----------------------------------------------------------------------------

CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    facility_id     UUID REFERENCES facility(id),
    visit_id        UUID REFERENCES visit(id),
    patient_id      UUID REFERENCES patient(id),
    doctor_id       UUID REFERENCES doctor(id),
    action_type     TEXT NOT NULL,  -- e.g. suggestion_shown, edit, finalize, view
    entity_type     TEXT NOT NULL,  -- e.g. diagnosis, prescription, investigation_order
    entity_id       UUID,
    payload         JSONB,  -- non-PHI summary: what changed, not full content
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_log IS 'Silent audit trail for medicolegal safety. Do not expose to patients. Never used to imply negligence.';

CREATE INDEX idx_audit_occurred ON audit_log(occurred_at);
CREATE INDEX idx_audit_visit ON audit_log(visit_id);
CREATE INDEX idx_audit_patient ON audit_log(patient_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- HELPER: updated_at trigger
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patient_updated_at
    BEFORE UPDATE ON patient
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER visit_updated_at
    BEFORE UPDATE ON visit
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
