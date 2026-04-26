const logger = require('../config/pinoLogger');
const { verifyToken } = require('../services/tokenService');

const requireAuth = (state) => async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    
    const token = authHeader.split(' ')[1];
    const { isRedisAvailable, redisClient } = state;

    if (isRedisAvailable && redisClient) {
        try {
            const data = await redisClient.get(`session:${token}`);
            if (!data) return res.status(401).json({ error: "Invalid token" });
            req.user = JSON.parse(data);
            next();
        } catch (error) {
            logger.error(`Auth Middleware Error: ${error.message}`);
            return res.status(500).json({ error: "Authentication service error" });
        }
    } else {
        // Fallback for development/offline mode
        req.user = { name: 'Fallback', role: 'doctor' };
        next();
    }
};

const socketAuth = (state) => async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error: No token provided"));
    
    try {
        const payload = verifyToken(token, process.env.JWT_SECRET);
        socket.user = payload;
        next();
    } catch (error) {
        logger.error(`Socket Auth Error: ${error.message}`);
        return next(new Error("Authentication error: Invalid or expired token"));
    }
};

module.exports = { requireAuth, socketAuth };
