const express = require('express');
const patientRoutes = require('./patientRoutes');
const visitRoutes = require('./visitRoutes');
const aiRoutes = require('./aiRoutes');
const clinicalRoutes = require('./clinicalRoutes');
const authRoutes = require('./authRoutes');

const router = express.Router();

router.use('/patients', patientRoutes);
router.use('/visits', visitRoutes);
router.use('/ai', aiRoutes);
router.use('/clinical', clinicalRoutes);
router.use('/auth', authRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ ok: true, status: 'live', timestamp: new Date().toISOString() });
});

module.exports = router;
