import jwt from 'jsonwebtoken';
import { AuthService } from '@/services/AuthService';
import type { User } from '@/entities/User';

jest.mock('@/config/env', () => ({
  env: {
    jwt: {
      secret: 'test-jwt-secret',
      expiresIn: '7d',
    },
  },
}));

jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: {
    sign: jest.fn(),
    verify: jest.fn(),
  },
}));

const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signToken signs payload with configured secret and expiry', () => {
    const user = {
      id: 'user-1',
      role: 'admin',
    } as User;

    mockedJwt.sign.mockReturnValue('signed-token' as never);

    const token = AuthService.signToken(user);

    expect(mockedJwt.sign).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        role: 'admin',
      },
      'test-jwt-secret',
      { expiresIn: '7d' },
    );
    expect(token).toBe('signed-token');
  });

  it('verifyToken validates and returns decoded payload', () => {
    const decoded = {
      userId: 'user-1',
      role: 'user',
      iat: 111,
      exp: 222,
    };
    mockedJwt.verify.mockReturnValue(decoded as never);

    const payload = AuthService.verifyToken('token-value');

    expect(mockedJwt.verify).toHaveBeenCalledWith('token-value', 'test-jwt-secret');
    expect(payload).toEqual(decoded);
  });
});
