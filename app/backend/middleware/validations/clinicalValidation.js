const Joi = require('joi');

const clinicalEvaluateSchema = Joi.object({
  patient: Joi.object({
    name: Joi.string().required(),
    age: Joi.number().required(),
    gender: Joi.string().valid('Male', 'Female', 'Other').required(),
  }).required(),
  complaint: Joi.string().required(),
  vitals: Joi.object({
    spo2: Joi.number(),
    rr: Joi.number(),
    hr: Joi.number(),
    sbp: Joi.number(),
    dbp: Joi.number(),
    temp: Joi.number(),
  }),
  history: Joi.object(),
  labs: Joi.object(),
});

module.exports = {
  clinicalEvaluateSchema,
};
