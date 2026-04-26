const patientRepository = require('../repositories/PatientRepository');
const { catchAsync } = require('../middleware/errorMiddleware');
const { ApiError } = require('../middleware/errorMiddleware');

const getPatients = catchAsync(async (req, res) => {
  const { facilityId } = req.user; // Assuming facilityId is in JWT
  const patients = await patientRepository.findAll(facilityId);
  res.json({ success: true, data: patients });
});

const getPatientById = catchAsync(async (req, res) => {
  const patient = await patientRepository.findById(req.params.id);
  if (!patient) {
    throw new ApiError(404, 'Patient not found');
  }
  res.json({ success: true, data: patient });
});

const createPatient = catchAsync(async (req, res) => {
  const { facilityId } = req.user;
  const patient = await patientRepository.create({
    ...req.body,
    facilityId
  });
  res.status(201).json({ success: true, data: patient });
});

const updatePatient = catchAsync(async (req, res) => {
  const patient = await patientRepository.update(req.params.id, req.body);
  res.json({ success: true, data: patient });
});

module.exports = {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient
};
