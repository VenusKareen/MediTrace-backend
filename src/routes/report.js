const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const { submitReport, getAllReports } = require('../controllers/reportController');

router.post('/', submitReport);
router.get('/all', protect, restrictTo(['admin']), getAllReports);

module.exports = router;