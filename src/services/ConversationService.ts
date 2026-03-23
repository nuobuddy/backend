import { AppDataSource } from '@/config/database';
import { Conversation } from '@/entities/Conversation';

export class ConversationService {
  private static repo = AppDataSource.getRepository(Conversation);

  static async create(userId: string, title?: string): Promise<Conversation> {
    const conversation = this.repo.create({
      userId,
      title: title?.trim() || 'New Chat',
      difyConversationId: null,
    });

    return this.repo.save(conversation);
  }

  static async updateDifyId(id: string, userId: string, difyConversationId: string): Promise<void> {
    await this.repo.update(
      { id, userId },
      { difyConversationId },
    );
  }

  static async listByUser(userId: string): Promise<Conversation[]> {
    return this.repo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  static async deleteByIdAndUser(id: string, userId: string): Promise<boolean> {
    const result = await this.repo.delete({ id, userId });
    return (result.affected ?? 0) > 0;
  }

  static async findByIdAndUser(id: string, userId: string): Promise<Conversation | null> {
    return this.repo.findOne({
      where: { id, userId },
    });
  }

  static async touch(id: string, userId: string): Promise<void> {
    await this.repo.createQueryBuilder()
      .update(Conversation)
      .set({ updatedAt: () => 'CURRENT_TIMESTAMP' })
      .where('id = :id', { id })
      .andWhere('userId = :userId', { userId })
      .execute();
  }
}
