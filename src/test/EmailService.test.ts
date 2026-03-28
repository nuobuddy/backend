import { EmailService } from '@/services/EmailService';
import { redis } from '@/config/redis';
import { UserService } from '@/services/UserService';

jest.mock('@/config/redis', () => ({
  redis: {
    setex: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
  },
}));

jest.mock('@/services/UserService', () => ({
  UserService: {
    findByEmail: jest.fn(),
  },
}));

const mockedRedis = redis as jest.Mocked<typeof redis>;
const mockedUserService = UserService as jest.Mocked<typeof UserService>;

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationCode', () => {
    it('returns empty string when no user is found', async () => {
      mockedUserService.findByEmail.mockResolvedValue(null);

      const code = await EmailService.sendVerificationCode('test@example.com', 'forgot-password');

      expect(code).toBe('');
      expect(mockedRedis.setex).not.toHaveBeenCalled();
    });

    it('successfully generates and stores a code', async () => {
      mockedRedis.setex.mockResolvedValue('OK');

      const code = await EmailService.sendVerificationCode('test@example.com', 'register');

      expect(code).toHaveLength(6);
      expect(typeof code).toBe('string');
      expect(mockedRedis.setex).toHaveBeenCalled();
    });

    it('successfully generates and stores a code for forgot-password', async () => {
      const dto = {
        username: 'alice',
        email: 'alice@example.com',
        password: 'secret123',
      };

      mockedUserService.findByEmail.mockResolvedValue(dto as never);
      mockedRedis.setex.mockResolvedValue('OK');
      const code = await EmailService.sendVerificationCode('alice@example.com', 'forgot-password');

      expect(code).toHaveLength(6);
      expect(typeof code).toBe('string');
      expect(mockedRedis.setex).toHaveBeenCalled();
    });
  });

  describe('verifyCode', () => {
    it('returns false if no code is stored', async () => {
      mockedRedis.get.mockResolvedValue(null);
      const isVerified = await EmailService.verifyCode('test@example.com', '123456', 'register');
      expect(isVerified).toBe(false);
    });
    it('returns false if code does not match', async () => {
      mockedRedis.get.mockResolvedValue('654321');
      const isVerified = await EmailService.verifyCode('test@example.com', '123456', 'register');
      expect(isVerified).toBe(false);
    });
    it('returns true if code matches', async () => {
      mockedRedis.get.mockResolvedValue('123456');
      const isVerified = await EmailService.verifyCode('test@example.com', '123456', 'register');
      expect(isVerified).toBe(true);
    });
  });

  describe('hasRecentCode', () => {
    it('returns true if rate limit key exists', async () => {
      mockedRedis.exists.mockResolvedValue(1);
      const hasRecent = await EmailService.hasRecentCode('test@example.com', 'register');
      expect(hasRecent).toBe(true);
    });

    it('returns false if rate limit key does not exist', async () => {
      mockedRedis.exists.mockResolvedValue(0);
      const hasRecent = await EmailService.hasRecentCode('test@example.com', 'register');
      expect(hasRecent).toBe(false);
    });
  });
});
