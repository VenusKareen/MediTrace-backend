const router = require('express').Router();
const auth = require('../middleware/auth');
const { register, login, refreshToken, logout, getMe } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', auth(), getMe);

module.exports = router;
