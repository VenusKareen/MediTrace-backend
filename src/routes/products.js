const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const {
  getAllProducts,
  getMyProducts,
  getProductById,
  createProduct,
  updateProductStatus,
} = require('../controllers/productController');

router.get('/mine', protect, restrictTo(['manufacturer']), getMyProducts);
router.post('/', protect, restrictTo(['manufacturer']), createProduct);
router.get('/', protect, restrictTo(['admin']), getAllProducts);
router.patch('/:id/status', protect, restrictTo(['admin']), updateProductStatus);
router.get('/:id', protect, getProductById);

module.exports = router;