const pool = require('../config/database');

exports.getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM antibiotic_products ORDER BY created_at DESC');
    res.json({ success: true, products: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyProducts = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM antibiotic_products WHERE manufacturer_id = $1 ORDER BY created_at DESC',
      [req.user.user_id]
    );
    res.json({ success: true, products: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM antibiotic_products WHERE product_id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createProduct = async (req, res) => {
  const { product_name, active_ingredient, dosage_form, strength, ppb_reg_number, manufacturer_name } = req.body;

  if (!product_name || !active_ingredient || !dosage_form || !strength || !ppb_reg_number)
    return res.status(400).json({ success: false, message: 'Missing required fields.' });

  try {
    const result = await pool.query(`
      INSERT INTO antibiotic_products
        (product_name, active_ingredient, dosage_form, strength, manufacturer_id, manufacturer_name, ppb_reg_number, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
      RETURNING *
    `, [product_name, active_ingredient, dosage_form, strength, req.user.user_id, manufacturer_name, ppb_reg_number]);

    res.status(201).json({ success: true, message: 'Product submitted for approval.', product: result.rows[0] });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ success: false, message: 'A product with this PPB registration number already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProductStatus = async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status))
    return res.status(400).json({ success: false, message: 'Status must be approved or rejected.' });

  try {
    const result = await pool.query(
      'UPDATE antibiotic_products SET status=$1, updated_at=NOW() WHERE product_id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product: result.rows[0] });
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