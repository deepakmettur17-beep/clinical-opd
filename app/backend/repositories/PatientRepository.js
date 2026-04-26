const { prisma } = require('../db');

class PatientRepository {
  async findById(id) {
    return prisma.patient.findUnique({
      where: { id },
      include: {
        facility: true,
        visits: {
          orderBy: { visitDate: 'desc' },
          take: 5
        }
      }
    });
  }

  async findByExternalId(facilityId, externalId) {
    return prisma.patient.findUnique({
      where: {
        facilityId_externalId: { facilityId, externalId }
      }
    });
  }

  async create(data) {
    return prisma.patient.create({
      data
    });
  }

  async update(id, data) {
    return prisma.patient.update({
      where: { id },
      data
    });
  }

  async findAll(facilityId, skip = 0, take = 20) {
    return prisma.patient.findMany({
      where: { facilityId },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    });
  }
}

module.exports = new PatientRepository();
