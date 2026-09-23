const { authorize } = require('../middleware/auth');
const { bookAppointment } = require('../services/bookAppointment');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
module.exports = function registerExtraRoutes(app, pool, authenticate) {
  app.post('/api/patients', async (req, res) => {
    try {
      const { fullName, email, password, dateOfBirth, phone, gender, address } = req.body;
      if (!fullName || !email || !password || !dateOfBirth || !phone) return res.status(400).json({ error: 'INVALID_INPUT' });
      const [user] = await pool.execute("INSERT INTO Users(full_name,email,password_hash,role) VALUES(?,?,?,'patient')", [fullName, email, await bcrypt.hash(password, 10)]);
      await pool.execute('INSERT INTO Patients(user_id,date_of_birth,phone,gender,address) VALUES(?,?,?,?,?)', [user.insertId, dateOfBirth, phone, gender || null, address || null]);
      res.status(201).json({ token: jwt.sign({ userId: user.insertId, role: 'patient' }, process.env.JWT_SECRET || 'development-secret', { expiresIn: '8h' }), role: 'patient' });
    } catch (error) { res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 400).json({ error: error.code === 'ER_DUP_ENTRY' ? 'EMAIL_EXISTS' : 'REGISTRATION_FAILED' }); }
  });
  app.get('/api/patients/:id', authenticate, authorize('patient', 'admin'), async (req, res) => {
    const [rows] = await pool.execute('SELECT p.*,u.full_name,u.email FROM Patients p JOIN Users u ON u.user_id=p.user_id WHERE p.patient_id=?', [req.params.id]);
    if (!rows.length || (req.user.role === 'patient' && rows[0].user_id !== req.user.userId)) return res.status(404).json({ error: 'PATIENT_NOT_FOUND' });
    res.json(rows[0]);
  });
  app.put('/api/doctors/:id', authenticate, authorize('doctor', 'admin'), async (req, res) => {
    const { specializationId, yearsExperience, consultationFee, avgRating, dailyCapacity } = req.body;
    const [owner] = await pool.execute('SELECT doctor_id FROM Doctors WHERE doctor_id=? AND (user_id=? OR ?=\'admin\')', [req.params.id, req.user.userId, req.user.role]);
    if (!owner.length) return res.status(404).json({ error: 'DOCTOR_NOT_FOUND' });
    await pool.execute('UPDATE Doctors SET specialization_id=COALESCE(?,specialization_id),years_experience=COALESCE(?,years_experience),consultation_fee=COALESCE(?,consultation_fee),avg_rating=COALESCE(?,avg_rating),daily_capacity=COALESCE(?,daily_capacity) WHERE doctor_id=?', [specializationId, yearsExperience, consultationFee, avgRating, dailyCapacity, req.params.id]);
    res.json({ ok: true });
  });
  app.post('/api/availability', authenticate, authorize('doctor', 'admin'), async (req, res) => {
    const { doctorId, dayOfWeek, startTime, endTime, slotDurationMin = 30 } = req.body;
    let targetDoctorId = doctorId;
    if (req.user.role === 'doctor') {
      const [doctor] = await pool.execute('SELECT doctor_id FROM Doctors WHERE user_id=?', [req.user.userId]);
      targetDoctorId = doctor[0]?.doctor_id;
    }
    if (!targetDoctorId || dayOfWeek === undefined || !startTime || !endTime) return res.status(400).json({ error: 'INVALID_INPUT' });
    const [owner] = await pool.execute('SELECT doctor_id FROM Doctors WHERE doctor_id = ? AND (user_id = ? OR ? = \'admin\')', [targetDoctorId, req.user.userId, req.user.role]);
    if (!owner.length) return res.status(403).json({ error: 'FORBIDDEN' });
    const [overlap] = await pool.execute('SELECT availability_id FROM Doctor_Availability WHERE doctor_id = ? AND day_of_week = ? AND is_active = TRUE AND start_time < ? AND end_time > ?', [targetDoctorId, dayOfWeek, endTime, startTime]);
    if (overlap.length) return res.status(409).json({ error: 'AVAILABILITY_OVERLAP' });
    const [result] = await pool.execute('INSERT INTO Doctor_Availability(doctor_id,day_of_week,start_time,end_time,slot_duration_min) VALUES(?,?,?,?,?)', [targetDoctorId, dayOfWeek, startTime, endTime, slotDurationMin]);
    res.status(201).json({ availabilityId: result.insertId });
  });
  app.get('/api/availability/doctor', authenticate, authorize('doctor'), async (req, res) => {
    const [rows] = await pool.execute('SELECT a.* FROM Doctor_Availability a JOIN Doctors d ON d.doctor_id=a.doctor_id WHERE d.user_id=? ORDER BY a.day_of_week,a.start_time', [req.user.userId]);
    res.json(rows);
  });
  app.patch('/api/availability/:id', authenticate, authorize('doctor', 'admin'), async (req, res) => {
    const { dayOfWeek, startTime, endTime, slotDurationMin, isActive } = req.body;
    const [rules] = await pool.execute('SELECT a.*,d.user_id FROM Doctor_Availability a JOIN Doctors d ON d.doctor_id=a.doctor_id WHERE a.availability_id=?', [req.params.id]);
    if (!rules.length || (req.user.role === 'doctor' && rules[0].user_id !== req.user.userId)) return res.status(403).json({ error: 'FORBIDDEN' });
    const rule = rules[0];
    const [overlap] = await pool.execute('SELECT availability_id FROM Doctor_Availability WHERE doctor_id=? AND availability_id<>? AND day_of_week=? AND is_active=TRUE AND start_time<? AND end_time>?', [rule.doctor_id, req.params.id, dayOfWeek ?? rule.day_of_week, endTime ?? rule.end_time, startTime ?? rule.start_time]);
    if (overlap.length) return res.status(409).json({ error: 'AVAILABILITY_OVERLAP' });
    await pool.execute('UPDATE Doctor_Availability SET day_of_week=COALESCE(?,day_of_week),start_time=COALESCE(?,start_time),end_time=COALESCE(?,end_time),slot_duration_min=COALESCE(?,slot_duration_min),is_active=COALESCE(?,is_active) WHERE availability_id=?', [dayOfWeek, startTime, endTime, slotDurationMin, isActive, req.params.id]);
    res.json({ ok: true });
  });
  app.post('/api/appointments', authenticate, authorize('patient'), async (req, res) => {
    const { doctorId, availabilityId, appointmentDate, startTime, endTime } = req.body;
    if (!doctorId || !availabilityId || !appointmentDate || !startTime || !endTime) return res.status(400).json({ error: 'INVALID_INPUT' });
    const [patients] = await pool.execute('SELECT patient_id FROM Patients WHERE user_id=?', [req.user.userId]);
    if (!patients.length) return res.status(404).json({ error: 'PATIENT_NOT_FOUND' });
    try {
      res.status(201).json(await bookAppointment(pool, { patientId: patients[0].patient_id, doctorId, availabilityId, appointmentDate, startTime, endTime }));
    } catch (error) {
      res.status(error.code === 'SLOT_TAKEN' || error.code === 'ER_DUP_ENTRY' ? 409 : 400).json({ error: error.code || 'BOOKING_FAILED' });
    }
  });
  app.patch('/api/appointments/:id/cancel', authenticate, authorize('patient', 'doctor', 'admin'), async (req, res) => {
    const [result] = await pool.execute("UPDATE Appointments a JOIN Patients p ON p.patient_id = a.patient_id LEFT JOIN Doctors d ON d.doctor_id = a.doctor_id SET a.status = 'cancelled' WHERE a.appointment_id = ? AND ((p.user_id = ? AND ? = 'patient') OR (d.user_id = ? AND ? = 'doctor') OR ? = 'admin') AND a.status = 'booked'", [req.params.id, req.user.userId, req.user.role, req.user.userId, req.user.role, req.user.role]);
    if (!result.affectedRows) return res.status(404).json({ error: 'APPOINTMENT_NOT_FOUND' });
    res.json({ ok: true, status: 'cancelled' });
  });
  app.patch('/api/appointments/:id/status', authenticate, authorize('doctor', 'admin'), async (req, res) => {
    const { status } = req.body;
    if (!['booked', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'INVALID_STATUS' });
    const [result] = await pool.execute('UPDATE Appointments a JOIN Doctors d ON d.doctor_id=a.doctor_id SET a.status=? WHERE a.appointment_id=? AND (d.user_id=? OR ?=\'admin\')', [status, req.params.id, req.user.userId, req.user.role]);
    if (!result.affectedRows) return res.status(404).json({ error: 'APPOINTMENT_NOT_FOUND' });
    res.json({ ok: true, status });
  });
  app.patch('/api/appointments/:id/emergency', authenticate, authorize('doctor', 'admin'), async (req, res) => {
    const [result] = await pool.execute('UPDATE Appointments a JOIN Doctors d ON d.doctor_id=a.doctor_id SET a.is_emergency=? WHERE a.appointment_id=? AND (d.user_id=? OR ?=\'admin\')', [Boolean(req.body.isEmergency), req.params.id, req.user.userId, req.user.role]);
    if (!result.affectedRows) return res.status(404).json({ error: 'APPOINTMENT_NOT_FOUND' });
    res.json({ ok: true, isEmergency: Boolean(req.body.isEmergency) });
  });
  app.patch('/api/appointments/:id/reschedule', authenticate, authorize('patient'), async (req, res) => {
    const [current] = await pool.execute('SELECT a.*,p.user_id FROM Appointments a JOIN Patients p ON p.patient_id=a.patient_id WHERE a.appointment_id=? AND p.user_id=? AND a.status=\'booked\'', [req.params.id, req.user.userId]);
    if (!current.length) return res.status(404).json({ error: 'APPOINTMENT_NOT_FOUND' });
    const { appointmentDate, startTime, endTime, availabilityId } = req.body;
    try { await pool.execute("UPDATE Appointments SET status='rescheduled' WHERE appointment_id=?", [req.params.id]); const result = await bookAppointment(pool, { patientId: current[0].patient_id, doctorId: current[0].doctor_id, availabilityId, appointmentDate, startTime, endTime }); res.json(result); }
    catch (error) { res.status(error.code === 'SLOT_TAKEN' ? 409 : 400).json({ error: error.code || 'RESCHEDULE_FAILED' }); }
  });
  app.get('/api/dashboard/doctor/:doctorId', authenticate, authorize('doctor', 'admin'), async (req, res) => {
    if (req.user.role === 'doctor') {
      const [owner] = await pool.execute('SELECT doctor_id FROM Doctors WHERE doctor_id=? AND user_id=?', [req.params.doctorId, req.user.userId]);
      if (!owner.length) return res.status(403).json({ error: 'FORBIDDEN' });
    }
    const [rows] = await pool.execute('SELECT a.*,u.full_name patient_name,p.phone FROM Appointments a JOIN Patients p ON p.patient_id=a.patient_id JOIN Users u ON u.user_id=p.user_id WHERE a.doctor_id=? AND a.appointment_date=CURDATE() ORDER BY a.start_time', [req.params.doctorId]);
    res.json(rows);
  });
  app.get('/api/dashboard/doctor', authenticate, authorize('doctor'), async (req, res) => {
    const [[doctor]] = await pool.execute('SELECT d.doctor_id,u.full_name doctor_name,s.name specialization FROM Doctors d JOIN Users u ON u.user_id=d.user_id JOIN Specializations s ON s.specialization_id=d.specialization_id WHERE d.user_id=?', [req.user.userId]);
    if (!doctor) return res.status(404).json({ error: 'DOCTOR_NOT_FOUND' });
    const [queue, attended] = await Promise.all([
      pool.execute('SELECT a.*,u.full_name patient_name,p.phone,p.date_of_birth FROM Appointments a JOIN Patients p ON p.patient_id=a.patient_id JOIN Users u ON u.user_id=p.user_id WHERE a.doctor_id=? AND a.status=\'booked\' AND a.appointment_date>=CURDATE() ORDER BY a.is_emergency DESC,a.appointment_date,a.start_time', [doctor.doctor_id]),
      pool.execute('SELECT a.*,u.full_name patient_name,p.phone,p.date_of_birth FROM Appointments a JOIN Patients p ON p.patient_id=a.patient_id JOIN Users u ON u.user_id=p.user_id WHERE a.doctor_id=? AND a.status=\'completed\' ORDER BY a.appointment_date DESC,a.start_time DESC', [doctor.doctor_id])
    ]);
    res.json({ doctor, queue: queue[0], attended: attended[0] });
  });
  app.get('/api/dashboard/admin', authenticate, authorize('admin'), async (req, res) => {
    const [[users], [appointments], [doctors]] = await Promise.all([
      pool.execute('SELECT role,COUNT(*) count FROM Users GROUP BY role'),
      pool.execute('SELECT status,COUNT(*) count FROM Appointments GROUP BY status'),
      pool.execute('SELECT COUNT(*) count FROM Doctors')
    ]);
    res.json({ users, appointments, doctors: doctors[0].count });
  });
  app.delete('/api/specializations/:id', authenticate, authorize('admin'), async (req, res) => {
    const [used] = await pool.execute('SELECT doctor_id FROM Doctors WHERE specialization_id=? LIMIT 1', [req.params.id]);
    if (used.length) return res.status(409).json({ error: 'SPECIALIZATION_IN_USE' });
    await pool.execute('DELETE FROM Specializations WHERE specialization_id=?', [req.params.id]);
    res.json({ ok: true });
  });
};
