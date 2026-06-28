const router = require('express').Router();
const { register, login, refreshToken, logout, getMe, verifyOtp, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register',        register);
router.post('/login',           login);
router.post('/refresh',         refreshToken);
router.post('/logout',          logout);
router.get('/me',               protect, getMe);
router.post('/verify-otp',      verifyOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

module.exports = router;
