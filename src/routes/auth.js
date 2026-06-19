const router = require('express').Router();
const { register, login, refreshToken, logout, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login',    login);
router.post('/refresh',  refreshToken);
router.post('/logout',   logout);
router.get('/me',        protect, getMe);

module.exports = router;