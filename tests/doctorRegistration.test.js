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
}));

const request = require('supertest');
const app = require('../server');
const pool = require('../db');

describe('doctor registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a doctor account with a doctor role and doctor profile', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      release: jest.fn(),
      execute: jest.fn()
        .mockResolvedValueOnce([{ insertId: 88 }])
        .mockResolvedValueOnce([{ insertId: 12 }]),
    };

    pool.getConnection.mockResolvedValue(connection);

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

    expect(response.status).toBe(201);
    expect(response.body.role).toBe('doctor');
    expect(response.body.token).toBe('doctor-token');
    expect(connection.execute).toHaveBeenCalledTimes(2);
    expect(connection.execute.mock.calls[0][0]).toContain('INSERT INTO Users');
    expect(connection.execute.mock.calls[1][0]).toContain('INSERT INTO Doctors');
  });
});
