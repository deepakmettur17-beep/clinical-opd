const { prisma } = require('../db');

class ClinicalRepository {
  // Findings
  async addFinding(data) {
    return prisma.clinicalFinding.create({ data });
  }

  async getFindingsByVisit(visitId) {
    return prisma.clinicalFinding.findMany({ where: { visitId } });
  }

  // Diagnoses
  async addDiagnosis(data) {
    return prisma.diagnosis.create({ data });
  }

  async getDiagnosesByPatient(patientId) {
    return prisma.diagnosis.findMany({ 
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Prescriptions
  async addPrescription(data) {
    return prisma.prescription.create({ data });
  }

  // Audit Logs
  async logAction(data) {
    return prisma.auditLog.create({ data });
  }

  async getAuditTrail(visitId) {
    return prisma.auditLog.findMany({
      where: { visitId },
      orderBy: { occurredAt: 'asc' }
    });
  }
}

module.exports = new ClinicalRepository();
