jest.mock('../services/generateSlots', () => ({ generateAvailableSlots: jest.fn() }));
jest.mock('../services/bookAppointment', () => ({ bookAppointment: jest.fn() }));
const { generateAvailableSlots } = require('../services/generateSlots');
const { bookAppointment } = require('../services/bookAppointment');
const { scheduleBestAvailable } = require('../services/scheduleBestAvailable');

function poolFor(doctors, loads = [0, 0]) {
  const connection = { execute: jest.fn()
    .mockResolvedValueOnce([doctors])
    .mockResolvedValueOnce([[{ booked: loads[0] }]])
    .mockResolvedValueOnce([[{ booked: loads[1] }]]) };
  return { getConnection: jest.fn().mockResolvedValue({ ...connection, release: jest.fn() }) };
}

test('falls back to the next ranked doctor after a slot conflict', async () => {
  const doctors = [
    { doctor_id: 11, full_name: 'Top Doctor', specialization: 'Cardiology', years_experience: 12, avg_rating: 5, daily_capacity: 8 },
    { doctor_id: 22, full_name: 'Backup Doctor', specialization: 'Cardiology', years_experience: 8, avg_rating: 4.5, daily_capacity: 8 }
  ];
  generateAvailableSlots.mockImplementation(async (_connection, doctorId) => [{ startTime: '09:00:00', endTime: '09:30:00', availabilityId: doctorId }]);
  bookAppointment.mockRejectedValueOnce(Object.assign(new Error('SLOT_TAKEN'), { code: 'SLOT_TAKEN' })).mockResolvedValueOnce({ appointmentId: 2, doctorId: 22 });
  const result = await scheduleBestAvailable(poolFor(doctors), { patientId: 3, specializationId: 1, preferredDate: '2030-01-07' });
  expect(result.doctorId).toBe(22);
  expect(bookAppointment).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({ doctorId: 22 }));
});

test('returns doctor details needed by the UI when a candidate is booked', async () => {
  const doctors = [
    { doctor_id: 11, full_name: 'Top Doctor', specialization: 'Cardiology', years_experience: 12, avg_rating: 5, daily_capacity: 8, consultation_fee: 900 }
  ];
  generateAvailableSlots.mockResolvedValue([{ startTime: '09:00:00', endTime: '09:30:00', availabilityId: 77 }]);
  bookAppointment.mockResolvedValueOnce({ appointmentId: 2, doctorId: 11, patientId: 3, appointmentDate: '2030-01-07', startTime: '09:00:00', endTime: '09:30:00', status: 'booked' });

  const result = await scheduleBestAvailable(poolFor(doctors), { patientId: 3, specializationId: 1, preferredDate: '2030-01-07' });

  expect(result.doctorName).toBe('Top Doctor');
  expect(result.yearsExperience).toBe(12);
  expect(result.consultationFee).toBe(900);
  expect(result.specialization).toBe('Cardiology');
});

test('returns NO_AVAILABLE_DOCTOR when every candidate has no slots', async () => {
  generateAvailableSlots.mockResolvedValue([]);
  await expect(scheduleBestAvailable(poolFor([{ doctor_id: 11 }]), { patientId: 3, specializationId: 1, preferredDate: '2030-01-07' })).rejects.toMatchObject({ code: 'NO_AVAILABLE_DOCTOR' });
});
