jest.mock('../db', () => ({
  getConnection: jest.fn(),
  execute: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('doctor-token'),
  verify: jest.fn((token) => token === 'admin-token'
    ? { userId: 1, role: 'admin' }
    : { userId: 2, role: 'doctor' }),
}));

const request = require('supertest');
const app = require('../server');
const pool = require('../db');

describe('admin doctor creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not expose public doctor self-registration', async () => {
    const response = await request(app)
      .post('/api/auth/register-doctor')
      .send({
        fullName: 'Dr. Test Doctor',
        email: 'doctor.signup@example.com',
        password: 'securePass123',
        phone: '5551234567',
        specializationId: 1,
        licenseNo: 'LIC-TEST-001',
        yearsExperience: 9,
        consultationFee: 850,
      });

    expect(response.status).toBe(404);
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  it('lets an admin create a doctor account and profile transactionally', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
      execute: jest.fn()
        .mockResolvedValueOnce([{ insertId: 88 }])
        .mockResolvedValueOnce([{ insertId: 12 }]),
    };
    pool.getConnection.mockResolvedValue(connection);

    const response = await request(app)
      .post('/api/admin/doctors')
      .set('Authorization', 'Bearer admin-token')
      .send({
        fullName: 'Dr. Admin Created',
        email: 'doctor.admin@example.com',
        password: 'securePass123',
        licenseNo: 'LIC-ADMIN-001',
        specializationId: 1,
        yearsExperience: 9,
        consultationFee: 850,
        dailyCapacity: 8,
      });

    expect(response.status).toBe(201);
    expect(response.body.doctorId).toBe(12);
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.execute).toHaveBeenCalledTimes(2);
    expect(connection.execute.mock.calls[0][0]).toContain("VALUES(?,?,?,'doctor')");
    expect(connection.execute.mock.calls[1][0]).toContain('INSERT INTO Doctors');
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it('prevents non-admin users from creating doctor accounts through the admin endpoint', async () => {
    const response = await request(app)
      .post('/api/admin/doctors')
      .set('Authorization', 'Bearer doctor-token')
      .send({ fullName: 'Dr. Not Admin' });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('FORBIDDEN');
    expect(pool.getConnection).not.toHaveBeenCalled();
  });
});
