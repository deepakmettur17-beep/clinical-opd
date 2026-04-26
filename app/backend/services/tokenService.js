const jwt = require('jsonwebtoken');

const generateToken = (user, secret, expiresIn) => {
  return jwt.sign(
    { 
      id: user.id, 
      role: user.role, 
      facilityId: user.facilityId,
      name: user.name 
    }, 
    secret, 
    { expiresIn }
  );
};

const generateAuthTokens = async (user) => {
  const accessTokenExpires = process.env.JWT_ACCESS_EXPIRATION || '30m';
  const accessToken = generateToken(user, process.env.JWT_SECRET, accessTokenExpires);

  const refreshTokenExpires = process.env.JWT_REFRESH_EXPIRATION || '7d';
  const refreshToken = generateToken(user, process.env.JWT_REFRESH_SECRET || 'refresh-secret', refreshTokenExpires);

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires,
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires,
    },
  };
};

const verifyToken = (token, secret) => {
  return jwt.verify(token, secret);
};

module.exports = {
  generateAuthTokens,
  verifyToken,
};
