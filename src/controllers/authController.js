require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/database');

exports.register = async (req, res) => {
  const { email, username, password, role, license_number, facility_name } = req.body;
  if (!email || !username || !password || !role)
    return res.status(400).json({ success: false, message: 'Missing required fields.' });

  try {
    const exists = await pool.query('SELECT user_id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(409).json({ success: false, message: 'Email already registered.' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(`
      INSERT INTO users (email, username, password_hash, role, license_number, facility_name)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING user_id, email, role, verification_status
    `, [email, username, hash, role, license_number || null, facility_name || null]);

    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password required.' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({ success: true, token, user: { user_id: user.user_id, email: user.email, role: user.role, username: user.username } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};