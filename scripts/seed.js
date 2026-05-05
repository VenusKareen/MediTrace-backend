require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const HMAC_SECRET = process.env.QR_HMAC_SECRET;
const BASE_URL    = process.env.BASE_URL;
const qrDir       = path.join(__dirname, '..', 'qrcodes');

function signBatch(batchId) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(batchId).digest('hex');
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...\n');

    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

    // ── Users ──
    const adminHash = await bcrypt.hash('Admin@1234', 10);
    const mfgHash   = await bcrypt.hash('Pharma@1234', 10);

    const adminRes = await client.query(`
      INSERT INTO users (email, username, password_hash, role, verification_status)
      VALUES ($1,$2,$3,'admin','approved')
      ON CONFLICT (email) DO UPDATE SET updated_at=NOW()
      RETURNING user_id
    `, ['admin@meditrace.ke', 'Admin', adminHash]);

    const mfgRes = await client.query(`
      INSERT INTO users (email, username, password_hash, role, facility_name, verification_status)
      VALUES ($1,$2,$3,'manufacturer',$4,'approved')
      ON CONFLICT (email) DO UPDATE SET updated_at=NOW()
      RETURNING user_id
    `, ['manufacturer@pharmaco.ke', 'PharmaCo', mfgHash, 'PharmaCo Kenya Ltd']);

    const adminId = adminRes.rows[0].user_id;
    const mfgId   = mfgRes.rows[0].user_id;
    console.log('Users created (admin + manufacturer)');

    // ── Product ──
    const prodRes = await client.query(`
      INSERT INTO antibiotic_products
        (product_name, active_ingredient, dosage_form, strength, manufacturer_id, manufacturer_name, ppb_reg_number, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'approved')
      ON CONFLICT (ppb_reg_number) DO UPDATE SET updated_at=NOW()
      RETURNING product_id
    `, ['Amoxicillin 500mg Capsules','Amoxicillin','Capsule','500mg', mfgId,'PharmaCo Kenya Ltd','PPB/2024/AMX/001']);

    const productId = prodRes.rows[0].product_id;
    console.log('Product created (Amoxicillin 500mg)');

    // ── Batches + QR codes ──
    const batches = [
      { number: 'AMX-2024-001', mfg: '2024-01-15', exp: '2026-01-15', qty: 1000, retailer: 'Nairobi Pharmacy', location: 'Nairobi CBD' },
      { number: 'AMX-2024-002', mfg: '2024-03-01', exp: '2026-03-01', qty: 500,  retailer: 'Mombasa Chemist',  location: 'Mombasa' },
      { number: 'AMX-2024-003', mfg: '2024-06-01', exp: '2026-06-01', qty: 750,  retailer: 'Kisumu Drugs',     location: 'Kisumu' },
    ];

    for (const b of batches) {
      const batchRes = await client.query(`
        INSERT INTO batches (product_id, batch_number, manufacturing_date, expiry_date, quantity, retailer, store_location, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'approved')
        ON CONFLICT (batch_number) DO UPDATE SET updated_at=NOW()
        RETURNING batch_id
      `, [productId, b.number, b.mfg, b.exp, b.qty, b.retailer, b.location]);

      const batchId = batchRes.rows[0].batch_id;
      const sig     = signBatch(batchId);
      const url     = `${BASE_URL}/verify/${batchId}?sig=${sig}`;

      await client.query(`
        INSERT INTO qr_codes (batch_id, encoded_url, signature)
        VALUES ($1,$2,$3)
        ON CONFLICT DO NOTHING
      `, [batchId, url, sig]);

      const qrPath = path.join(qrDir, `${b.number}.png`);
      await QRCode.toFile(qrPath, url, { width: 300 });

      console.log(`Batch ${b.number} → QR saved`);
      console.log(`   URL: ${url}`);
    }

    console.log('\nSeed complete!\n');
    console.log('Admin login:        admin@meditrace.ke / Admin@1234');
    console.log('Manufacturer login: manufacturer@pharmaco.ke / Pharma@1234');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Top level error:', err);
  process.exit(1);
});