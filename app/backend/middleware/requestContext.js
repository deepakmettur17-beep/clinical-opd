const { v4: uuidv4 } = require('uuid');

const requestContext = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.id);
  next();
};

module.exports = requestContext;
