require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const QRCode = require('qrcode');
const path   = require('path');
const fs     = require('fs');

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
    console.log('Seeding MediTrace (presentation data)...\n');

    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

    // ── 1. Admin account ──────────────────────────────────────────────────────
    const adminHash = await bcrypt.hash('Admin@1234', 12);
    await client.query(`
      INSERT INTO users (email, username, password_hash, role, verification_status)
      VALUES ($1, $2, $3, 'admin', 'approved')
      ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
    `, ['admin@meditrace.ke', 'Admin', adminHash]);
    console.log('Admin account ready');

    // ── 2. Demo manufacturer (approved — so you can demo the portal) ──────────
    const mfgHash = await bcrypt.hash('Pharma@2025', 12);
    const mfgRes  = await client.query(`
      INSERT INTO users
        (email, username, password_hash, role, license_number, facility_name, verification_status)
      VALUES ($1, $2, $3, 'manufacturer', $4, $5, 'approved')
      ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
      RETURNING user_id
    `, [
      'info@elyspharmaceuticals.ke',
      'Elys Pharmaceuticals',
      mfgHash,
      'MFG/PPB/2019/0042',
      'Elys Chemical & Industrial Supplies Ltd'
    ]);
    const mfgId = mfgRes.rows[0].user_id;
    console.log('Manufacturer account ready');

    // ── 3. Demo pharmacist (approved) ────────────────────────────────────────
    const pharmHash = await client.query(`
      INSERT INTO users
        (email, username, password_hash, role, license_number, facility_name, verification_status)
      VALUES ($1, $2, $3, 'pharmacist', $4, $5, 'approved')
      ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
      RETURNING user_id
    `, [
      'pharmacist@goodlife.ke',
      'Good Life Pharmacy',
      await bcrypt.hash('Pharm@2025', 12),
      'PPB/PHARM/2020/1134',
      'Good Life Pharmacy — Westlands'
    ]);
    console.log('Pharmacist account ready');

    // ── 4. Products ───────────────────────────────────────────────────────────
    const prod1Res = await client.query(`
      INSERT INTO antibiotic_products
        (product_name, active_ingredient, dosage_form, strength,
         manufacturer_id, manufacturer_name, ppb_reg_number, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'approved')
      ON CONFLICT (ppb_reg_number) DO UPDATE SET updated_at = NOW()
      RETURNING product_id
    `, [
      'Amoxicillin 500mg Capsules',
      'Amoxicillin Trihydrate',
      'Capsule',
      '500mg',
      mfgId,
      'Elys Chemical & Industrial Supplies Ltd',
      'PPB/2024/AMX/00147'
    ]);

    const prod2Res = await client.query(`
      INSERT INTO antibiotic_products
        (product_name, active_ingredient, dosage_form, strength,
         manufacturer_id, manufacturer_name, ppb_reg_number, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'approved')
      ON CONFLICT (ppb_reg_number) DO UPDATE SET updated_at = NOW()
      RETURNING product_id
    `, [
      'Doxycycline 100mg Tablets',
      'Doxycycline Hyclate',
      'Tablet',
      '100mg',
      mfgId,
      'Elys Chemical & Industrial Supplies Ltd',
      'PPB/2024/DOX/00089'
    ]);

    const prod1Id = prod1Res.rows[0].product_id;
    const prod2Id = prod2Res.rows[0].product_id;
    console.log('Products created (Amoxicillin + Doxycycline)');

    // ── 5. Batches ────────────────────────────────────────────────────────────
    // Three scenarios for your demo:
    //   Batch A → VALID   (scans green — current, not expired)
    //   Batch B → EXPIRED (scans as expired — expiry date in the past)
    //   Batch C → VALID   (second product, also green)
    const batches = [
      {
        productId: prod1Id,
        number:    'AMX-2025-001',
        mfg:       '2025-01-10',
        exp:       '2027-01-10',       // valid — far future
        qty:       1000,
        retailer:  'Good Life Pharmacy',
        location:  'Westlands, Nairobi',
        status:    'approved',
        label:     'VALID (Amoxicillin)'
      },
      {
        productId: prod1Id,
        number:    'AMX-2023-009',
        mfg:       '2023-01-01',
        exp:       '2025-01-01',       // expired — date is in the past
        qty:       500,
        retailer:  'Nairobi Chemist',
        location:  'Tom Mboya Street, Nairobi',
        status:    'approved',
        label:     'EXPIRED (Amoxicillin — for demo)'
      },
      {
        productId: prod2Id,
        number:    'DOX-2025-001',
        mfg:       '2025-03-01',
        exp:       '2027-03-01',       // valid — far future
        qty:       750,
        retailer:  'Haltons Pharmacy',
        location:  'Karen, Nairobi',
        status:    'approved',
        label:     'VALID (Doxycycline)'
      },
    ];

    console.log('\nGenerating batches and QR codes:');
    for (const b of batches) {
      const batchRes = await client.query(`
        INSERT INTO batches
          (product_id, batch_number, manufacturing_date, expiry_date,
           quantity, retailer, store_location, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (batch_number) DO UPDATE SET updated_at = NOW()
        RETURNING batch_id
      `, [b.productId, b.number, b.mfg, b.exp, b.qty, b.retailer, b.location, b.status]);

      const batchId = batchRes.rows[0].batch_id;
      const sig     = signBatch(batchId);
      const url     = `${BASE_URL}/verify/${batchId}?sig=${sig}`;

      await client.query(`
        INSERT INTO qr_codes (batch_id, encoded_url, signature)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [batchId, url, sig]);

      const qrPath = path.join(qrDir, `${b.number}.png`);
      await QRCode.toFile(qrPath, url, { width: 400, margin: 2 });

      console.log(`  ${b.label}`);
      console.log(`  Batch: ${b.number}`);
      console.log(`  QR saved: qrcodes/${b.number}.png`);
      console.log(`  URL: ${url}\n`);
    }

    console.log('─────────────────────────────────────────');
    console.log('Seed complete. Accounts:\n');
    console.log('  Admin:        admin@meditrace.ke       / Admin@1234');
    console.log('  Manufacturer: info@elyspharmaceuticals.ke / Pharma@2025');
    console.log('  Pharmacist:   pharmacist@goodlife.ke   / Pharm@2025\n');
    console.log('QR codes to print for your demo:');
    console.log('  qrcodes/AMX-2025-001.png  → scans VALID');
    console.log('  qrcodes/AMX-2023-009.png  → scans EXPIRED');
    console.log('  qrcodes/DOX-2025-001.png  → scans VALID');
    console.log('─────────────────────────────────────────');

  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();