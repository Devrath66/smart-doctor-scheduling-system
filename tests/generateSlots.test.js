const { generateAvailableSlots } = require('../services/generateSlots');

test('does not offer slots occupied by cancelled appointments', async () => {
  const connection = {
    execute: jest.fn()
      .mockResolvedValueOnce([[
        { availability_id: 7, start_time: '09:00:00', end_time: '10:00:00', slot_duration_min: 30 }
      ]])
      .mockResolvedValueOnce([[
        { start_time: '09:00:00', status: 'cancelled' }
      ]])
  };

  const slots = await generateAvailableSlots(connection, 11, '2030-01-07');

  expect(connection.execute.mock.calls[1][0]).not.toContain("status='booked'");
  expect(slots).toEqual([
    { startTime: '09:30:00', endTime: '10:00:00', availabilityId: 7 }
  ]);
});
