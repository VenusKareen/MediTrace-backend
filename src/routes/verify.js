const router = require('express').Router();
const { verifyQR } = require('../controllers/verifyController');
router.get('/:batchId', verifyQR);
module.exports = router;