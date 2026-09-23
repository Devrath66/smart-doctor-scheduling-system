const { bookAppointment } = require('../services/bookAppointment');

test('rejects a booked slot inside the transaction', async () => {
  const connection = {
    beginTransaction: jest.fn(),
    rollback: jest.fn(),
    commit: jest.fn(),
    release: jest.fn(),
    execute: jest.fn().mockResolvedValueOnce([[{ appointment_id: 42 }]])
  };
  const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
  await expect(bookAppointment(pool, { patientId: 1, doctorId: 2, availabilityId: 3, appointmentDate: '2030-01-07', startTime: '09:00:00', endTime: '09:30:00' })).rejects.toMatchObject({ code: 'SLOT_TAKEN' });
  expect(connection.rollback).toHaveBeenCalled();
  expect(connection.commit).not.toHaveBeenCalled();
});
