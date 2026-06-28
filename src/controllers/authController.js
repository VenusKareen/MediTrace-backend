require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/database');

//Helpers

const signAccessToken = (user) =>
  jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

const signRefreshToken = (user) =>
  jwt.sign(
    { user_id: user.user_id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

//Register

exports.register = async (req, res) => {
  const { username, email, password, role, license_number, facility_name } = req.body;

  if (!username || !email || !password || !role)
    return res.status(400).json({ success: false, message: 'Missing required fields.' });

  if (password.length < 8)
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

  const allowed = ['consumer', 'pharmacist', 'manufacturer', 'admin'];
  if (!allowed.includes(role))
    return res.status(400).json({ success: false, message: 'Invalid role.' });

  try {
    const exists = await pool.query('SELECT user_id FROM users WHERE email=$1', [email]);
    if (exists.rows.length)
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });

    const hash = await bcrypt.hash(password, 12);

    const result = await pool.query(`
      INSERT INTO users (username, email, password_hash, role, license_number, facility_name)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING user_id, username, email, role, license_number, facility_name, verification_status
    `, [username, email, hash, role, license_number || null, facility_name || null]);

    const user = result.rows[0];

    const accessToken  = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await pool.query('UPDATE users SET refresh_token=$1 WHERE user_id=$2', [refreshToken, user.user_id]);

    return res.status(201).json({
      success: true,
      message: 'Registration submitted. Awaiting administrator approval.',
      data: {
        accessToken,
        refreshToken,
        user: {
          id:                  user.user_id,
          username:            user.username,
          email:               user.email,
          role:                user.role,
          license_number:      user.license_number,
          facility_name:       user.facility_name,
          verification_status: user.verification_status,
        }
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

//Login 

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password required.' });

  try {
    const result = await pool.query(
      `SELECT user_id, username, email, password_hash, role,
              license_number, facility_name, verification_status
       FROM users WHERE email=$1`,
      [email]
    );
    const user = result.rows[0];

    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const accessToken  = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await pool.query('UPDATE users SET refresh_token=$1 WHERE user_id=$2', [refreshToken, user.user_id]);

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id:                  user.user_id,
          username:            user.username,
          email:               user.email,
          role:                user.role,
          license_number:      user.license_number,
          facility_name:       user.facility_name,
          verification_status: user.verification_status,
        }
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

//Refresh Token

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(401).json({ success: false, message: 'Refresh token required.' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const result = await pool.query(
      `SELECT user_id, username, email, role, verification_status
       FROM users WHERE user_id=$1 AND refresh_token=$2`,
      [decoded.user_id, refreshToken]
    );
    const user = result.rows[0];

    if (!user)
      return res.status(403).json({ success: false, message: 'Invalid refresh token.' });

    const newAccessToken  = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);
    await pool.query('UPDATE users SET refresh_token=$1 WHERE user_id=$2', [newRefreshToken, user.user_id]);

    return res.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken }
    });
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
};

//Logout 

exports.logout = async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      await pool.query('UPDATE users SET refresh_token=NULL WHERE user_id=$1', [decoded.user_id]);
    } catch (_) {
      // token already invalid — still log out cleanly
    }
  }

  return res.json({ success: true, message: 'Logged out successfully.' });
};

//Get current user

exports.getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT user_id, username, email, role,
              license_number, facility_name, verification_status, created_at
       FROM users WHERE user_id=$1`,
      [req.user.user_id]
    );
    const user = result.rows[0];
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found.' });

    return res.status(200).json({
      success: true,
      user: {
        id:                  user.user_id,
        username:            user.username,
        email:               user.email,
        role:                user.role,
        license_number:      user.license_number,
        facility_name:       user.facility_name,
        verification_status: user.verification_status,
        created_at:          user.created_at,
      }
    });
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
// ── OTP Verify ────────────────────────────────────────────────────────────────
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ success: false, message: 'Email and OTP required.' });

  try {
    const result = await pool.query(
      `SELECT user_id, otp_code, otp_expires_at FROM users WHERE email=$1`, [email]
    );
    const user = result.rows[0];
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found.' });

    if (!user.otp_code || user.otp_code !== otp)
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });

    if (new Date() > new Date(user.otp_expires_at))
      return res.status(400).json({ success: false, message: 'OTP has expired.' });

    await pool.query(
      `UPDATE users SET is_email_verified=true, otp_code=NULL, otp_expires_at=NULL WHERE user_id=$1`,
      [user.user_id]
    );

    return res.json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    console.error('verifyOtp error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Forgot Password ───────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ success: false, message: 'Email required.' });

  try {
    const result = await pool.query(`SELECT user_id FROM users WHERE email=$1`, [email]);
    const user = result.rows[0];

    // Always return success to prevent email enumeration
    if (!user)
      return res.json({ success: true, message: 'If that email exists, a reset OTP has been sent.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await pool.query(
      `UPDATE users SET otp_code=$1, otp_expires_at=$2 WHERE user_id=$3`,
      [otp, expires, user.user_id]
    );

    // TODO: Send OTP via email/SMS. For now log it.
    console.log(`[MediTrace] Password reset OTP for ${email}: ${otp}`);

    return res.json({ success: true, message: 'If that email exists, a reset OTP has been sent.', debug_otp: process.env.NODE_ENV === 'development' ? otp : undefined });
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Reset Password ────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  const { email, otp, new_password } = req.body;
  if (!email || !otp || !new_password)
    return res.status(400).json({ success: false, message: 'Email, OTP, and new password required.' });

  if (new_password.length < 8)
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

  try {
    const result = await pool.query(
      `SELECT user_id, otp_code, otp_expires_at FROM users WHERE email=$1`, [email]
    );
    const user = result.rows[0];
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found.' });

    if (!user.otp_code || user.otp_code !== otp)
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });

    if (new Date() > new Date(user.otp_expires_at))
      return res.status(400).json({ success: false, message: 'OTP has expired. Request a new one.' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      `UPDATE users SET password_hash=$1, otp_code=NULL, otp_expires_at=NULL, refresh_token=NULL WHERE user_id=$2`,
      [hash, user.user_id]
    );

    return res.json({ success: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
