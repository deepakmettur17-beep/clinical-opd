const { prisma } = require('../db');

class VisitRepository {
  async findById(id) {
    return prisma.visit.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: true,
        findings: true,
        diagnoses: true,
        prescriptions: true,
        orders: true,
        advice: true,
        followUps: true
      }
    });
  }

  async create(data) {
    return prisma.visit.create({
      data
    });
  }

  async update(id, data) {
    return prisma.visit.update({
      where: { id },
      data
    });
  }

  async findByPatient(patientId) {
    return prisma.visit.findMany({
      where: { patientId },
      orderBy: { visitDate: 'desc' }
    });
  }

  async finalize(id, doctorId, recordHash) {
    return prisma.visit.update({
      where: { id },
      data: {
        status: 'closed',
        finalized: true,
        finalizedAt: new Date(),
        doctorId,
        recordHash
      }
    });
  }
}

module.exports = new VisitRepository();
