const pool = require('../config/database');

exports.getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT user_id, username, email, role, license_number, facility_name,
             verification_status, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    res.json({ success: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateUserStatus = async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status))
    return res.status(400).json({ success: false, message: 'Status must be approved or rejected.' });

  try {
    const result = await pool.query(`
      UPDATE users
      SET verification_status = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING user_id, username, email, role, verification_status
    `, [status, req.params.id]);

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};