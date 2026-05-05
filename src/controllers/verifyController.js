const crypto = require('crypto');
const pool   = require('../config/database');

exports.verifyQR = async (req, res) => {
  const { batchId } = req.params;
  const { sig }     = req.query;

  if (!batchId || !sig)
    return res.status(400).json({ success: false, message: 'Missing batchId or signature.' });

  const expected = crypto.createHmac('sha256', process.env.QR_HMAC_SECRET).update(batchId).digest('hex');
  if (sig !== expected)
    return res.json({ success: true, result: 'counterfeit', message: 'Invalid QR code signature.' });

  try {
    const result = await pool.query(`
      SELECT b.*, p.product_name, p.active_ingredient, p.dosage_form, p.strength,
             p.manufacturer_name, p.ppb_reg_number, p.status AS product_status
      FROM batches b
      JOIN antibiotic_products p ON p.product_id = b.product_id
      WHERE b.batch_id = $1
    `, [batchId]);

    if (!result.rows.length)
      return res.json({ success: true, result: 'invalid', message: 'Product not found in database.' });

    const batch = result.rows[0];

    if (batch.status !== 'approved' || batch.product_status !== 'approved')
      return res.json({ success: true, result: 'invalid', message: 'Product not approved.' });

    const now = new Date();
    if (new Date(batch.expiry_date) < now)
      return res.json({ success: true, result: 'expired', message: 'Product has expired.', batch });

    await pool.query(`
      INSERT INTO scan_logs (batch_id, scan_result, ip_address)
      VALUES ($1,'valid',$2)
    `, [batchId, req.ip]);

    res.json({ success: true, result: 'valid', message: 'Product is authentic.', batch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};