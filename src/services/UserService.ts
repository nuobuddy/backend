import bcrypt from 'bcrypt';
import { AppDataSource } from '@/config/database';
import { User } from '@/entities/User';

export type PublicUser = Pick<User, 'id' | 'username' | 'email' | 'role' | 'isActive' | 'createdAt' | 'updatedAt'>;

const SALT_ROUNDS = 10;

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class UserService {
  static async register(username: string, email: string, password: string): Promise<PublicUser> {
    const userRepo = AppDataSource.getRepository(User);

    const existingByEmail = await userRepo.findOne({ where: { email } });
    if (existingByEmail) {
      throw new Error('email already in use');
    }

    const existingByUsername = await userRepo.findOne({ where: { username } });
    if (existingByUsername) {
      throw new Error('username already in use');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = userRepo.create({
      username,
      email,
      passwordHash,
    });

    const saved = await userRepo.save(user);
    return toPublicUser(saved);
  }

  static async validateCredentials(
    options: { email?: string; username?: string },
    password: string,
  ): Promise<PublicUser | null> {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: options.email ? { email: options.email } : { username: options.username },
    });
    if (!user) return null;

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;

    return toPublicUser(user);
  }

  static async findById(id: string): Promise<PublicUser | null> {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id } });
    if (!user) return null;
    return toPublicUser(user);
  }

  static async findByEmail(email: string): Promise<PublicUser | null> {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { email } });
    if (!user) return null;
    return toPublicUser(user);
  }

  static async resetPassword(userId: string, newPassword: string): Promise<PublicUser> {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('user not found');
    }

    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const saved = await userRepo.save(user);
    return toPublicUser(saved);
  }
}
