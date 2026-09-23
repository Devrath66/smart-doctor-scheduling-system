require('dotenv').config();
const express = require('express');
require('express-async-errors');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const { authenticate, authorize } = require('./middleware/auth');
const { scheduleBestAvailable } = require('./services/scheduleBestAvailable');
const { generateAvailableSlots } = require('./services/generateSlots');
const registerExtraRoutes = require('./routes/extra');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const tokenFor = user => jwt.sign({ userId: user.user_id, role: user.role }, process.env.JWT_SECRET || 'development-secret', { expiresIn: '8h' });

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.post('/api/auth/register', authLimit, async (req, res) => {
  try {
    const { fullName, email, password, dateOfBirth, phone, gender, address } = req.body;
    if (!fullName || !email || !password || !dateOfBirth || !phone) return res.status(400).json({ error: 'INVALID_INPUT' });
    const hash = await bcrypt.hash(password, 10);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [user] = await connection.execute("INSERT INTO Users(full_name,email,password_hash,role) VALUES(?,?,?,'patient')", [fullName, email, hash]);
      await connection.execute('INSERT INTO Patients(user_id,date_of_birth,phone,gender,address) VALUES(?,?,?,?,?)', [user.insertId, dateOfBirth, phone, gender || null, address || null]);
      await connection.commit();
      res.status(201).json({ token: tokenFor({ user_id: user.insertId, role: 'patient' }), role: 'patient' });
    } finally { connection.release(); }
  } catch (error) { res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 400).json({ error: error.code === 'ER_DUP_ENTRY' ? 'EMAIL_EXISTS' : 'REGISTRATION_FAILED' }); }
});
app.post('/api/auth/register-doctor', authLimit, async (req, res) => {
  try {
    const { fullName, email, password, phone, specializationId, licenseNo, yearsExperience, consultationFee } = req.body;
    if (!fullName || !email || !password || !phone || !specializationId || !licenseNo) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }
    const hash = await bcrypt.hash(password, 10);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [user] = await connection.execute("INSERT INTO Users(full_name,email,password_hash,role) VALUES(?,?,?,'doctor')", [fullName, email, hash]);
      await connection.execute('INSERT INTO Doctors(user_id,specialization_id,license_no,years_experience,consultation_fee,avg_rating,daily_capacity) VALUES(?,?,?,?,?,5.00,8)', [user.insertId, specializationId, licenseNo, yearsExperience || 0, consultationFee || 700]);
      await connection.commit();
      res.status(201).json({ token: tokenFor({ user_id: user.insertId, role: 'doctor' }), role: 'doctor' });
    } finally { connection.release(); }
  } catch (error) {
    const message = error.code === 'ER_DUP_ENTRY' ? 'EMAIL_EXISTS' : 'DOCTOR_REGISTRATION_FAILED';
    res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 400).json({ error: message });
  }
});
app.post('/api/auth/login', authLimit, async (req, res) => {
  try {
    const [users] = await pool.execute('SELECT * FROM Users WHERE email=?', [req.body.email]);
    if (!users.length || !(await bcrypt.compare(req.body.password || '', users[0].password_hash))) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    res.json({ token: tokenFor(users[0]), role: users[0].role, userId: users[0].user_id });
  } catch (error) { res.status(500).json({ error: 'SERVER_ERROR' }); }
});
app.get('/api/specializations', async (req, res) => res.json((await pool.execute('SELECT * FROM Specializations ORDER BY name'))[0]));
app.get('/api/doctors', async (req, res) => {
  const id = req.query.specializationId || null;
  const [rows] = await pool.execute('SELECT d.doctor_id,u.full_name,s.name specialization,d.years_experience,d.consultation_fee,d.avg_rating,d.daily_capacity FROM Doctors d JOIN Users u ON u.user_id=d.user_id JOIN Specializations s ON s.specialization_id=d.specialization_id WHERE (? IS NULL OR d.specialization_id=?)', [id, id]);
  res.json(rows);
});
app.get('/api/availability/:doctorId/:date', async (req, res) => { const connection = await pool.getConnection(); try { res.json(await generateAvailableSlots(connection, req.params.doctorId, req.params.date)); } finally { connection.release(); } });
app.post('/api/smart-schedule', authenticate, authorize('patient'), async (req, res) => {
  try {
    if (!req.body.specializationId || !req.body.preferredDate) return res.status(400).json({ error: 'INVALID_INPUT' });
    const [patients] = await pool.execute('SELECT patient_id FROM Patients WHERE user_id=?', [req.user.userId]);
    if (!patients.length) return res.status(404).json({ error: 'PATIENT_NOT_FOUND' });
    res.status(201).json(await scheduleBestAvailable(pool, { patientId: patients[0].patient_id, specializationId: req.body.specializationId, preferredDate: req.body.preferredDate }));
  } catch (error) { res.status(error.code === 'NO_AVAILABLE_DOCTOR' ? 409 : 500).json({ error: error.code || 'SERVER_ERROR' }); }
});
app.get('/api/appointments', authenticate, async (req, res) => {
  const query = req.user.role === 'patient'
    ? 'SELECT a.*,u.full_name doctor_name FROM Appointments a JOIN Doctors d ON d.doctor_id=a.doctor_id JOIN Users u ON u.user_id=d.user_id JOIN Patients p ON p.patient_id=a.patient_id WHERE p.user_id=? ORDER BY a.appointment_date,a.start_time'
    : req.user.role === 'doctor'
      ? 'SELECT a.*,u.full_name patient_name,p.phone FROM Appointments a JOIN Patients p ON p.patient_id=a.patient_id JOIN Users u ON u.user_id=p.user_id JOIN Doctors d ON d.doctor_id=a.doctor_id WHERE d.user_id=? ORDER BY a.appointment_date,a.start_time'
      : 'SELECT * FROM Appointments ORDER BY appointment_date,start_time';
  const [rows] = await pool.execute(query, req.user.role === 'patient' || req.user.role === 'doctor' ? [req.user.userId] : []);
  res.json(rows);
});
registerExtraRoutes(app, pool, authenticate);
app.use((error, req, res, next) => {
  if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ECONNREFUSED') {
    return res.status(503).json({ error: 'DATABASE_UNAVAILABLE', message: 'Configure MySQL credentials in .env, then restart the server.' });
  }
  res.status(500).json({ error: 'SERVER_ERROR' });
});
const port = Number(process.env.PORT || 3000);
async function ensureSchemaCompatibility() {
  const [columns] = await pool.execute("SHOW COLUMNS FROM Appointments LIKE 'is_emergency'");
  if (!columns.length) {
    await pool.execute('ALTER TABLE Appointments ADD COLUMN is_emergency BOOLEAN DEFAULT FALSE');
    console.log('Added Appointments.is_emergency column.');
  }
  await pool.execute("UPDATE Users SET email=CONCAT(LOWER(REPLACE(REPLACE(full_name,'Dr. ',''),' ','.')),'@dkhospital.com') WHERE role='doctor'");
}
if (require.main === module) {
  ensureSchemaCompatibility()
    .catch((error) => console.error(`Schema compatibility check failed: ${error.message}`))
    .finally(() => app.listen(port, () => console.log(`Clinic Scheduler listening on ${port}`)));
}
module.exports = app;
