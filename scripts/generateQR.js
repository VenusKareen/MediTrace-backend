require('dotenv').config();
const crypto = require('crypto');
const QRCode = require('qrcode');
const pool   = require('../src/config/database');
const fs     = require('fs');
const path   = require('path');

const OUTPUT_DIR = path.join(__dirname, '../qrcodes');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

async function generateQRCodes() {
  try {
    const { rows: batches } = await pool.query(
      `SELECT b.batch_id, b.batch_number, b.expiry_date, b.status,
              p.product_name, p.active_ingredient, p.strength, p.manufacturer_name
       FROM batches b
       JOIN antibiotic_products p ON p.product_id = b.product_id
       WHERE b.status = 'approved'`
    );

    if (!batches.length) {
      console.log('No approved batches found.');
      process.exit(0);
    }

    console.log(`Generating QR codes for ${batches.length} batches...\n`);

    for (const batch of batches) {
      const sig = crypto
        .createHmac('sha256', process.env.QR_HMAC_SECRET)
        .update(batch.batch_id)
        .digest('hex');

      const url = `${process.env.BASE_URL.replace('/api', '')}/verify/${batch.batch_id}?sig=${sig}`;

      const filename = path.join(OUTPUT_DIR, `${batch.batch_number}.png`);
      await QRCode.toFile(filename, url, {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });

      await pool.query(`
        INSERT INTO qr_codes (batch_id, encoded_url, signature)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [batch.batch_id, url, sig]);

      console.log(`DONE: ${batch.batch_number} - ${batch.product_name} (${batch.strength})`);
      console.log(`  URL: ${url}`);
      console.log(`  File: ${filename}\n`);
    }

    console.log(`Done. ${batches.length} QR codes saved to ./qrcodes/`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

generateQRCodes();
