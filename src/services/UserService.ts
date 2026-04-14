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

export interface WeeklyNewUsersPoint {
  weekStart: string;
  weekEnd: string;
  newUsers: number;
}

export interface WeeklyNewUsersResult {
  from: string;
  to: string;
  points: WeeklyNewUsersPoint[];
}

export class UserService {
  private static userRepository = () => AppDataSource.getRepository(User);

  private static readonly DAY_MS = 24 * 60 * 60 * 1000;

  private static formatUtcDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private static startOfUtcWeek(date: Date): Date {
    const normalized = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ));

    const day = normalized.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    normalized.setUTCDate(normalized.getUTCDate() + diff);
    return normalized;
  }

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

  /**
   * Admin: Weekly new users over a fixed number of months.
   */
  static async getWeeklyNewUsersForPastMonths(
    months: number = 6,
  ): Promise<WeeklyNewUsersResult> {
    const now = new Date();
    const fromDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - months,
      now.getUTCDate(),
    ));

    const firstWeekStart = this.startOfUtcWeek(fromDate);
    const currentWeekStart = this.startOfUtcWeek(now);

    const rows = await this.userRepository()
      .createQueryBuilder('user')
      .select(
        'DATE_TRUNC(\'week\', user.createdAt AT TIME ZONE \'UTC\')::date',
        'week_start',
      )
      .addSelect('COUNT(*)', 'new_users')
      .where('user.createdAt >= :fromDate', { fromDate: fromDate.toISOString() })
      .andWhere('user.createdAt <= :toDate', { toDate: now.toISOString() })
      .groupBy('week_start')
      .orderBy('week_start', 'ASC')
      .getRawMany<{ week_start: string; new_users: string }>();

    const countByWeek = new Map<string, number>(
      rows.map((row) => [row.week_start, parseInt(row.new_users, 10) || 0]),
    );

    const points: WeeklyNewUsersPoint[] = [];
    let cursor = new Date(firstWeekStart);

    while (cursor <= currentWeekStart) {
      const weekStart = this.formatUtcDate(cursor);
      const weekEndDate = new Date(cursor.getTime() + (6 * this.DAY_MS));

      points.push({
        weekStart,
        weekEnd: this.formatUtcDate(weekEndDate),
        newUsers: countByWeek.get(weekStart) ?? 0,
      });

      cursor = new Date(cursor.getTime() + (7 * this.DAY_MS));
    }

    return {
      from: this.formatUtcDate(fromDate),
      to: this.formatUtcDate(now),
      points,
    };
  }
}
