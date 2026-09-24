const { appointmentCard } = require('../public/portal.js');

test('includes a cancel action for upcoming booked appointments', () => {
  const card = appointmentCard({
    appointment_id: 55,
    doctor_name: 'Dr. Lopez',
    appointment_date: '2030-01-10',
    start_time: '09:00:00',
    end_time: '09:30:00',
    status: 'booked'
  });

  expect(card).toContain('Cancel appointment');
  expect(card).toContain('data-action="cancel"');
});

test('does not show cancel action for completed or cancelled appointments', () => {
  const cancelledCard = appointmentCard({
    appointment_id: 56,
    doctor_name: 'Dr. Chen',
    appointment_date: '2030-01-11',
    start_time: '10:00:00',
    end_time: '10:30:00',
    status: 'cancelled'
  });
  const completedCard = appointmentCard({
    appointment_id: 57,
    doctor_name: 'Dr. Chen',
    appointment_date: '2030-01-12',
    start_time: '11:00:00',
    end_time: '11:30:00',
    status: 'completed'
  });

  expect(cancelledCard).not.toContain('Cancel appointment');
  expect(completedCard).not.toContain('Cancel appointment');
});
