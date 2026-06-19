const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const { getBatchesByProduct, getMyBatches, createBatch, generateQR } = require('../controllers/batchController');

router.get('/mine', protect, restrictTo(['manufacturer']), getMyBatches);
router.get('/', protect, restrictTo(['manufacturer']), getBatchesByProduct);
router.post('/', protect, restrictTo(['manufacturer']), createBatch);
router.post('/:id/generate-qr', protect, restrictTo(['manufacturer']), generateQR);

module.exports = router;