const pool = require('../config/database');

exports.submitReport = async (req, res) => {
  const { pharmacy_name, location, medication_name, description, batch_id } = req.body;
  const reported_by = req.user ? req.user.user_id : null;

  try {
    await pool.query(`
      INSERT INTO counterfeit_reports (reported_by, batch_id, pharmacy_name, location, medication_name, description)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [reported_by, batch_id || null, pharmacy_name, location, medication_name, description || null]);

    res.json({ success: true, message: 'Report submitted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllReports = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM counterfeit_reports ORDER BY created_at DESC');
    res.json({ success: true, reports: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};