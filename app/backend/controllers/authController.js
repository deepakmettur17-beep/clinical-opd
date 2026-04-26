const { generateAuthTokens, verifyToken } = require('../services/tokenService');
const { catchAsync, ApiError } = require('../middleware/errorMiddleware');
const logger = require('../config/pinoLogger');

// Mock login for now - to be replaced with DB check
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  
  // In real implementation:
  // const user = await userService.loginUserWithEmailAndPassword(email, password);
  
  const mockUser = {
    id: 'mock-id',
    name: 'Dr. Deepakkumar',
    role: 'CONSULTANT',
    facilityId: 'mock-facility-id'
  };

  const tokens = await generateAuthTokens(mockUser);
  res.json({ success: true, data: { user: mockUser, tokens } });
});

const refreshTokens = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ApiError(400, 'Refresh token required');
  }

  try {
    const payload = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret');
    
    // In real implementation: check if refresh token is in DB/Redis
    
    const user = {
      id: payload.id,
      role: payload.role,
      facilityId: payload.facilityId,
      name: payload.name
    };

    const tokens = await generateAuthTokens(user);
    res.json({ success: true, data: { tokens } });
  } catch (error) {
    throw new ApiError(401, 'Invalid refresh token');
  }
});

const logout = catchAsync(async (req, res) => {
  // In real implementation: remove refresh token from DB/Redis
  res.json({ success: true, message: 'Logged out' });
});

module.exports = {
  login,
  refreshTokens,
  logout
};
