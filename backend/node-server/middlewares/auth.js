const jwt = require('jsonwebtoken');
const logger = require('./logger');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expecting 'Bearer TOKEN'

  if (!token) {
    return res.status(401).json({ message: 'Access Denied: No Token Provided' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_for_tanvi_boutique_event_suite_2026');
    req.user = verified;
    next();
  } catch (err) {
    logger.error(`Token verification failure: ${err.message}`);
    return res.status(403).json({ message: 'Invalid or Expired Token' });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt by user: ${req.user ? req.user.email : 'Unknown'} to restricted path.`);
      return res.status(403).json({ message: 'Access Denied: Insufficient Permissions' });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  restrictTo
};
