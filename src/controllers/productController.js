const pool = require('../config/database');

exports.getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM antibiotic_products ORDER BY created_at DESC');
    res.json({ success: true, products: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllBatches = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, p.product_name, p.manufacturer_name
      FROM batches b JOIN antibiotic_products p ON p.product_id = b.product_id
      ORDER BY b.created_at DESC
    `);
    res.json({ success: true, batches: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getScanLogs = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM scan_logs ORDER BY scanned_at DESC LIMIT 100');
    res.json({ success: true, logs: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};