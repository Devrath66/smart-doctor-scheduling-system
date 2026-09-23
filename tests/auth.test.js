const { authorize } = require('../middleware/auth');

test('denies a patient from a doctor-only route', () => {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  authorize('doctor')({ user: { role: 'patient' } }, response, next);
  expect(response.status).toHaveBeenCalledWith(403);
  expect(response.json).toHaveBeenCalledWith({ error: 'FORBIDDEN' });
  expect(next).not.toHaveBeenCalled();
});
