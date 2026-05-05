const router  = require('express').Router();
const auth    = require('../middleware/auth');
const { submitReport, getAllReports } = require('../controllers/reportController');
router.post('/', submitReport);
router.get('/all', auth(['admin']), getAllReports);
module.exports = router;