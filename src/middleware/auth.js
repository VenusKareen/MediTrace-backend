const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader)
    return res.status(401).json({ success: false, message: 'No token provided.' });

  const token = authHeader.split(' ')[1];
  if (!token)
    return res.status(401).json({ success: false, message: 'Malformed token.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

const restrictTo = (roles = []) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  next();
};

module.exports = { protect, restrictTo };