import bcrypt from 'bcrypt';
import { AppDataSource } from '@/config/database';
import { User } from '@/entities/User';

const BCRYPT_ROUNDS = 12;

export interface RegisterDto {
  username: string;
  email: string;
  password: string;
}

export interface UpdateProfileDto {
  username?: string;
  password?: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  role?: 'user' | 'admin';
}

export class UserService {
  private static userRepository = () => AppDataSource.getRepository(User);

  /**
   * Register a new user.
   */
  static async register(data: RegisterDto): Promise<User> {
    const { username, email, password } = data;

    // Check for existing user
    const existing = await this.userRepository().findOne({
      where: [{ email }, { username }],
    });

    if (existing) {
      if (existing.email === email) {
        throw new Error('Email already registered');
      }
      throw new Error('Username already taken');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = this.userRepository().create({
      username,
      email,
      passwordHash,
      role: 'user',
      isActive: true,
    });

    return this.userRepository().save(user);
  }

  /**
   * Validate user credentials.
   */
  static async validateCredentials(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.userRepository().findOne({
      where: { email },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    return user;
  }

  /**
   * Find user by ID.
   */
  static async findById(id: string): Promise<User | null> {
    return this.userRepository().findOne({ where: { id } });
  }

  /**
   * Find user by email.
   */
  static async findByEmail(email: string): Promise<User | null> {
    return this.userRepository().findOne({ where: { email } });
  }

  /**
   * Update user profile (username/password).
   */
  static async updateProfile(
    userId: string,
    data: UpdateProfileDto,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (data.username) {
      const existing = await this.userRepository().findOne({
        where: { username: data.username },
      });
      if (existing && existing.id !== userId) {
        throw new Error('Username already taken');
      }
      user.username = data.username;
    }

    if (data.password) {
      user.passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    }

    return this.userRepository().save(user);
  }

  /**
   * Public function: Reset user password.
   * Used by both user forgot-password flow and admin reset.
   */
  static async resetPassword(
    userId: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userRepository().save(user);
  }

  /**
   * Admin: Create a new user.
   */
  static async createUser(data: CreateUserDto): Promise<User> {
    const {
      username, email, password, role = 'user',
    } = data;

    const existing = await this.userRepository().findOne({
      where: [{ email }, { username }],
    });

    if (existing) {
      if (existing.email === email) {
        throw new Error('Email already registered');
      }
      throw new Error('Username already taken');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = this.userRepository().create({
      username,
      email,
      passwordHash,
      role,
      isActive: true,
    });

    return this.userRepository().save(user);
  }

  /**
   * Admin: Delete a user.
   */
  static async deleteUser(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    await this.userRepository().remove(user);
  }

  /**
   * Admin: List all users with pagination.
   */
  static async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.userRepository().findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    // Remove passwordHash from results
    const safeUsers = users.map((u) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...rest } = u;
      return rest;
    });

    return { users: safeUsers as User[], total };
  }

  /**
   * Admin: Enable or disable a user account.
   */
  static async updateStatus(userId: string, isActive: boolean): Promise<void> {
    await this.userRepository().update(userId, { isActive });
  }

  /**
   * Admin: Get user count.
   */
  static async count(): Promise<number> {
    return this.userRepository().count();
  }
}
