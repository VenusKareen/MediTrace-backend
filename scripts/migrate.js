require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const migrations = [

  `CREATE TABLE IF NOT EXISTS users (
    user_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) UNIQUE NOT NULL,
    username            VARCHAR(100) NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,
    role                VARCHAR(50)  NOT NULL CHECK (role IN ('consumer','pharmacist','manufacturer','admin')),
    license_number      VARCHAR(100),
    facility_name       VARCHAR(200),
    verification_status VARCHAR(50)  NOT NULL DEFAULT 'pending'
                        CHECK (verification_status IN ('pending','approved','rejected')),
    refresh_token       TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS antibiotic_products (
    product_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name      VARCHAR(200) NOT NULL,
    active_ingredient VARCHAR(200) NOT NULL,
    dosage_form       VARCHAR(100) NOT NULL,
    strength          VARCHAR(100) NOT NULL,
    manufacturer_id   UUID REFERENCES users(user_id) ON DELETE CASCADE,
    manufacturer_name VARCHAR(200) NOT NULL,
    ppb_reg_number    VARCHAR(100) UNIQUE NOT NULL,
    status            VARCHAR(50)  NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected')),
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS batches (
    batch_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id         UUID REFERENCES antibiotic_products(product_id) ON DELETE CASCADE,
    batch_number       VARCHAR(100) UNIQUE NOT NULL,
    manufacturing_date DATE NOT NULL,
    expiry_date        DATE NOT NULL,
    quantity           INTEGER NOT NULL,
    retailer           VARCHAR(200),
    store_location     VARCHAR(200),
    status             VARCHAR(50)  NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected')),
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS qr_codes (
    qr_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id    UUID REFERENCES batches(batch_id) ON DELETE CASCADE,
    encoded_url TEXT         NOT NULL,
    signature   VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS scan_logs (
    log_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id    UUID REFERENCES batches(batch_id)  ON DELETE SET NULL,
    scanned_by  UUID REFERENCES users(user_id)     ON DELETE SET NULL,
    scan_result VARCHAR(50) NOT NULL
                CHECK (scan_result IN ('valid','invalid','expired','counterfeit')),
    location    VARCHAR(200),
    ip_address  VARCHAR(50),
    scanned_at  TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS counterfeit_reports (
    report_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reported_by     UUID REFERENCES users(user_id)   ON DELETE SET NULL,
    batch_id        UUID REFERENCES batches(batch_id) ON DELETE SET NULL,
    pharmacy_name   VARCHAR(200),
    location        VARCHAR(200),
    medication_name VARCHAR(200),
    description     TEXT,
    status          VARCHAR(50) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','investigating','resolved')),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_scan_logs_batch_id   ON scan_logs(batch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at ON scan_logs(scanned_at)`,
  `CREATE INDEX IF NOT EXISTS idx_scan_logs_result     ON scan_logs(scan_result)`,
  `CREATE INDEX IF NOT EXISTS idx_batches_product_id   ON batches(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_qr_codes_batch_id    ON qr_codes(batch_id)`,

  `ALTER TABLE users DROP COLUMN IF EXISTS name`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT`,

];

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running MediTrace migrations...\n');
    for (let i = 0; i < migrations.length; i++) {
      await client.query(migrations[i]);
      console.log(`  [${i + 1}/${migrations.length}] done`);
    }
    console.log('\n All migrations completed successfully.');
  } catch (err) {
    console.error('\n Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('Top-level error:', err);
  process.exit(1);
});