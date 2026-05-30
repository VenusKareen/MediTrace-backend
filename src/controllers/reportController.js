const pool = require('../config/database');

exports.submitReport = async (req, res) => {
  const { pharmacy_name, location, medication_name, description, batch_id } = req.body;
  const reported_by = req.user ? req.user.user_id : null;

  try {
    // batch_id from Android is the batch_number string (e.g. "AMX-2024-001")
    // Look up the actual UUID from the batches table first
    let batchUuid = null;
    if (batch_id) {
      const batchResult = await pool.query(
        'SELECT batch_id FROM batches WHERE batch_number = $1',
        [batch_id]
      );
      batchUuid = batchResult.rows[0]?.batch_id || null;
    }

    await pool.query(`
      INSERT INTO counterfeit_reports (reported_by, batch_id, pharmacy_name, location, medication_name, description)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [reported_by, batchUuid, pharmacy_name, location, medication_name, description || null]);

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