const crypto  = require('crypto');
const path    = require('path');
const fs      = require('fs');
const QRCode  = require('qrcode');
const pool    = require('../config/database');

const qrDir = path.join(__dirname, '..', '..', 'qrcodes');

// Verify is mounted at the root, NOT under /api — strip a trailing /api from BASE_URL if present
function getVerifyBaseUrl() {
  return (process.env.BASE_URL || '').replace(/\/api\/?$/, '');
}

function signBatch(batchId) {
  return crypto.createHmac('sha256', process.env.QR_HMAC_SECRET).update(batchId).digest('hex');
}

// GET /api/batches?product_id=...
exports.getBatchesByProduct = async (req, res) => {
  const { product_id } = req.query;
  if (!product_id)
    return res.status(400).json({ success: false, message: 'product_id is required.' });

  try {
    const result = await pool.query(`
      SELECT b.*, q.encoded_url
      FROM batches b
      LEFT JOIN qr_codes q ON q.batch_id = b.batch_id
      WHERE b.product_id = $1
      ORDER BY b.created_at DESC
    `, [product_id]);

    const batches = await Promise.all(result.rows.map(async (row) => {
      const has_qr = !!row.encoded_url;
      const qr_url = has_qr ? await QRCode.toDataURL(row.encoded_url) : null;
      return { ...row, has_qr, qr_url };
    }));

    res.json({ success: true, batches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/batches/mine — all batches across all of this manufacturer's products
exports.getMyBatches = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*
      FROM batches b
      JOIN antibiotic_products p ON p.product_id = b.product_id
      WHERE p.manufacturer_id = $1
      ORDER BY b.created_at DESC
    `, [req.user.user_id]);

    res.json({ success: true, batches: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/batches
exports.createBatch = async (req, res) => {
  const { product_id, batch_number, manufacturing_date, expiry_date, quantity, retailer, store_location } = req.body;

  if (!product_id || !batch_number || !manufacturing_date || !expiry_date || !quantity)
    return res.status(400).json({ success: false, message: 'Missing required fields.' });

  try {
    const owner = await pool.query('SELECT manufacturer_id FROM antibiotic_products WHERE product_id = $1', [product_id]);
    if (owner.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Product not found.' });
    if (owner.rows[0].manufacturer_id !== req.user.user_id)
      return res.status(403).json({ success: false, message: 'You do not own this product.' });

    const result = await pool.query(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiry_date, quantity, retailer, store_location, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
      RETURNING *
    `, [product_id, batch_number, manufacturing_date, expiry_date, quantity, retailer || null, store_location || null]);

    res.status(201).json({ success: true, batch: result.rows[0] });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ success: false, message: 'A batch with this number already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/batches/:id/generate-qr
exports.generateQR = async (req, res) => {
  const { id } = req.params;

  try {
    const batchRes = await pool.query(`
      SELECT b.*, p.manufacturer_id
      FROM batches b
      JOIN antibiotic_products p ON p.product_id = b.product_id
      WHERE b.batch_id = $1
    `, [id]);

    if (batchRes.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Batch not found.' });

    const batch = batchRes.rows[0];
    if (batch.manufacturer_id !== req.user.user_id)
      return res.status(403).json({ success: false, message: 'You do not own this batch.' });
    if (batch.status !== 'approved')
      return res.status(400).json({ success: false, message: 'Batch must be approved before generating a QR code.' });

    const existing = await pool.query('SELECT * FROM qr_codes WHERE batch_id = $1', [id]);
    if (existing.rows.length > 0) {
      const dataUrl = await QRCode.toDataURL(existing.rows[0].encoded_url);
      return res.json({ success: true, data: { qr_image_url: dataUrl, encoded_url: existing.rows[0].encoded_url } });
    }

    const sig = signBatch(id);
    const verifyBase = getVerifyBaseUrl();
    const encodedUrl = `${verifyBase}/verify/${id}?sig=${sig}`;

    await pool.query(
      'INSERT INTO qr_codes (batch_id, encoded_url, signature) VALUES ($1,$2,$3)',
      [id, encodedUrl, sig]
    );

    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
    const filePath = path.join(qrDir, `${batch.batch_number}.png`);
    await QRCode.toFile(filePath, encodedUrl, { width: 400, margin: 2 });

    const dataUrl = await QRCode.toDataURL(encodedUrl);
    res.json({ success: true, data: { qr_image_url: dataUrl, encoded_url: encodedUrl } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};