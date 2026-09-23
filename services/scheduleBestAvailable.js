const { generateAvailableSlots } = require('./generateSlots');
const { computeDoctorScore } = require('./rankDoctors');
const { bookAppointment } = require('./bookAppointment');

async function scheduleBestAvailable(pool, { patientId, specializationId, preferredDate }) {
  const connection = await pool.getConnection();
  try {
    const [doctors] = await connection.execute(
      'SELECT d.*,u.full_name,s.name specialization FROM Doctors d JOIN Users u ON u.user_id=d.user_id JOIN Specializations s ON s.specialization_id=d.specialization_id WHERE d.specialization_id=?',
      [specializationId]
    );
    const candidates = [];
    for (const doctor of doctors) {
      const slots = await generateAvailableSlots(connection, doctor.doctor_id, preferredDate);
      if (!slots.length) continue;
      const [load] = await connection.execute("SELECT COUNT(*) booked FROM Appointments WHERE doctor_id=? AND appointment_date=? AND status='booked'", [doctor.doctor_id, preferredDate]);
      candidates.push({ doctor, slots, booked: Number(load[0].booked), hoursUntilNextSlot: hoursUntil(preferredDate, slots[0].startTime) });
    }
    if (!candidates.length) throw Object.assign(new Error('NO_AVAILABLE_DOCTOR'), { code: 'NO_AVAILABLE_DOCTOR' });
    const maxHours = Math.max(...candidates.map(candidate => candidate.hoursUntilNextSlot), 1);
    const maxExperience = Math.max(...candidates.map(candidate => candidate.doctor.years_experience), 1);
    const ranked = candidates.map(candidate => ({
      ...candidate,
      score: computeDoctorScore({
        hoursUntilNextSlot: candidate.hoursUntilNextSlot,
        maxHoursUntilNextSlot: maxHours,
        yearsExperience: candidate.doctor.years_experience,
        maxYearsExperience: maxExperience,
        avgRating: Number(candidate.doctor.avg_rating),
        bookedSlotsToday: candidate.booked,
        dailyCapacity: candidate.doctor.daily_capacity
      })
    })).sort((a, b) => b.score - a.score);
    for (const candidate of ranked) {
      const slot = candidate.slots[0];
      try {
        const appointment = await bookAppointment(pool, { patientId, doctorId: candidate.doctor.doctor_id, availabilityId: slot.availabilityId, appointmentDate: preferredDate, startTime: slot.startTime, endTime: slot.endTime });
        return {
          ...appointment,
          doctorName: candidate.doctor.full_name,
          specialization: candidate.doctor.specialization,
          yearsExperience: candidate.doctor.years_experience,
          consultationFee: candidate.doctor.consultation_fee,
          avgRating: candidate.doctor.avg_rating,
          score: candidate.score
        };
      } catch (error) {
        if (error.code === 'SLOT_TAKEN' || error.code === 'ER_DUP_ENTRY') continue;
        throw error;
      }
    }
    throw Object.assign(new Error('NO_AVAILABLE_DOCTOR'), { code: 'NO_AVAILABLE_DOCTOR' });
  } finally { connection.release(); }
}
function hoursUntil(date, time) { return Math.max(0, (new Date(`${date}T${time}`) - new Date()) / 3600000); }
module.exports = { scheduleBestAvailable };
