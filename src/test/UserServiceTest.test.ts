import bcrypt from 'bcrypt';
import { AppDataSource } from '@/config/database';
import { UserService } from '@/services/UserService';

const mockRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
};

jest.mock('@/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => mockRepo),
  },
}));

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
    compare: jest.fn(),
  },
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedDataSource = AppDataSource as unknown as {
  getRepository: jest.Mock;
};

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('creates and saves a new user when email and username are available', async () => {
      const dto = {
        username: 'alice',
        email: 'alice@example.com',
        password: 'secret123',
      };
      const createdUser = {
        id: 'user-1',
        username: dto.username,
        email: dto.email,
        passwordHash: 'hashed-password',
        role: 'user' as const,
        isActive: true,
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      mockRepo.create.mockReturnValue(createdUser);
      mockRepo.save.mockResolvedValue(createdUser);

      const result = await UserService.register(dto);

      expect(mockedDataSource.getRepository).toHaveBeenCalledTimes(3);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: [{ email: dto.email }, { username: dto.username }],
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(dto.password, 12);
      expect(mockRepo.create).toHaveBeenCalledWith({
        username: dto.username,
        email: dto.email,
        passwordHash: 'hashed-password',
        role: 'user',
        isActive: true,
      });
      expect(mockRepo.save).toHaveBeenCalledWith(createdUser);
      expect(result).toEqual(createdUser);
    });

    it('throws when email is already registered', async () => {
      mockRepo.findOne.mockResolvedValue({ email: 'taken@example.com', username: 'other' });

      await expect(
        UserService.register({
          username: 'new-user',
          email: 'taken@example.com',
          password: 'password',
        }),
      ).rejects.toThrow('Email already registered');
    });

    it('throws when username is already taken', async () => {
      mockRepo.findOne.mockResolvedValue({ email: 'other@example.com', username: 'alice' });

      await expect(
        UserService.register({
          username: 'alice',
          email: 'new@example.com',
          password: 'password',
        }),
      ).rejects.toThrow('Username already taken');
    });
  });

  describe('validateCredentials', () => {
    it('returns null when user is missing', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await UserService.validateCredentials('nobody@example.com', 'secret');

      expect(result).toBeNull();
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('returns null when user is inactive', async () => {
      const user = {
        id: 'user-1',
        email: 'alice@example.com',
        passwordHash: 'hash',
        isActive: false,
      };
      mockRepo.findOne.mockResolvedValue(user);

      const result = await UserService.validateCredentials('alice@example.com', 'secret');

      expect(result).toBeNull();
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('returns null when password is invalid', async () => {
      const user = {
        id: 'user-1',
        email: 'alice@example.com',
        passwordHash: 'hash',
        isActive: true,
      };
      mockRepo.findOne.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await UserService.validateCredentials('alice@example.com', 'wrong-password');

      expect(result).toBeNull();
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('wrong-password', 'hash');
    });

    it('returns user when password is valid', async () => {
      const user = {
        id: 'user-1',
        email: 'alice@example.com',
        passwordHash: 'hash',
        isActive: true,
      };
      mockRepo.findOne.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await UserService.validateCredentials('alice@example.com', 'secret');

      expect(result).toEqual(user);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('secret', 'hash');
    });
  });

  describe('updateProfile', () => {
    it('throws when user cannot be found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(UserService.updateProfile('missing-user', { username: 'new-name' })).rejects.toThrow('User not found');
    });

    it('updates username and password when provided', async () => {
      const user = {
        id: 'user-1',
        username: 'old-name',
        email: 'user@example.com',
        passwordHash: 'old-hash',
        isActive: true,
      };

      mockRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null);
      mockedBcrypt.hash.mockResolvedValue('new-hash' as never);
      mockRepo.save.mockResolvedValue({ ...user, username: 'new-name', passwordHash: 'new-hash' });

      const result = await UserService.updateProfile('user-1', {
        username: 'new-name',
        password: 'new-password',
      });

      expect(mockRepo.findOne).toHaveBeenNthCalledWith(1, { where: { id: 'user-1' } });
      expect(mockRepo.findOne).toHaveBeenNthCalledWith(2, { where: { username: 'new-name' } });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('new-password', 12);
      expect(mockRepo.save).toHaveBeenCalledWith(user);
      expect(result).toEqual({ ...user, username: 'new-name', passwordHash: 'new-hash' });
    });
  });

  describe('findAll', () => {
    it('returns paginated users without passwordHash', async () => {
      const users = [
        {
          id: 'u1',
          username: 'alice',
          email: 'alice@example.com',
          passwordHash: 'hash-1',
          role: 'user' as const,
          isActive: true,
        },
      ];
      mockRepo.findAndCount.mockResolvedValue([users, 1]);

      const result = await UserService.findAll(2, 5);

      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        skip: 5,
        take: 5,
        order: { createdAt: 'DESC' },
      });
      expect(result.total).toBe(1);
      expect(result.users).toEqual([
        {
          id: 'u1',
          username: 'alice',
          email: 'alice@example.com',
          role: 'user',
          isActive: true,
        },
      ]);
      expect(result.users[0]).not.toHaveProperty('passwordHash');
    });
  });
});
