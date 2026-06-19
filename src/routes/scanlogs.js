const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const { getScanLogs } = require('../controllers/productController');

router.get('/', protect, restrictTo(['admin']), getScanLogs);

module.exports = router;