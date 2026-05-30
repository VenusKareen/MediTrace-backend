const router = require('express').Router();
const pool   = require('../config/database');

// ── Get all products ──────────────────────────────────────────────────────
router.get('/all', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM products');
        res.json({ success: true, products: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Get single product by batchId ─────────────────────────────────────────
router.get('/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;
        const { rows } = await pool.query(
            `SELECT * FROM products WHERE batch_number = $1`,
            [batchId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json({ success: true, product: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
