const router = require('express').Router();
const auth   = require('../middleware/auth');
const { getAllProducts, getAllBatches, getScanLogs } = require('../controllers/productController');
router.get('/all',    auth(['admin','manufacturer']), getAllProducts);
router.get('/batches', auth(['admin','manufacturer']), getAllBatches);
router.get('/scanlogs', auth(['admin']), getScanLogs);
module.exports = router;