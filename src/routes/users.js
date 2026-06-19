const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const { getAllUsers, updateUserStatus } = require('../controllers/userController');

router.get('/', protect, restrictTo(['admin']), getAllUsers);
router.patch('/:id/verify', protect, restrictTo(['admin']), updateUserStatus);

module.exports = router;