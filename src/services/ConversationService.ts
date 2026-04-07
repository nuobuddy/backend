import { AppDataSource } from '@/config/database';
import { Conversation } from '@/entities/Conversation';
import { Message } from '@/entities/Message';

export class ConversationService {
  // Lazy getters — called only after DataSource is initialized
  private static repo = () => AppDataSource.getRepository(Conversation);

  private static msgRepo = () => AppDataSource.getRepository(Message);

  // ==================== Conversations ====================

  static async findByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ conversations: Conversation[]; total: number }> {
    const [conversations, total] = await this.repo().findAndCount({
      where: { userId },
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { conversations, total };
  }

  static async create(userId: string, title?: string): Promise<Conversation> {
    const conversation = this.repo().create({
      userId,
      title: title || null,
      share: false,
    });
    return this.repo().save(conversation);
  }

  static async findById(conversationId: string): Promise<Conversation | null> {
    return this.repo().findOne({ where: { id: conversationId } });
  }

  static async findByIdWithMessages(
    conversationId: string,
  ): Promise<Conversation | null> {
    return this.repo().findOne({
      where: { id: conversationId },
      relations: ['messages'],
      order: { messages: { timestamp: 'ASC' } },
    });
  }

  static async delete(conversationId: string): Promise<void> {
    await this.repo().delete({ id: conversationId });
  }

  static async updateDifyConversationId(
    conversationId: string,
    difyConversationId: string,
  ): Promise<void> {
    await this.repo().update(conversationId, { difyConversationId });
  }

  static async updateTitle(
    conversationId: string,
    title: string,
  ): Promise<void> {
    await this.repo().update(conversationId, { title });
  }

  // ==================== Share ====================

  static async enableShare(conversationId: string): Promise<void> {
    await this.repo().update(conversationId, { share: true });
  }

  static async disableShare(conversationId: string): Promise<void> {
    await this.repo().update(conversationId, { share: false });
  }

  // ==================== Messages ====================

  static async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<Message> {
    const message = this.msgRepo().create({ conversationId, role, content });
    return this.msgRepo().save(message);
  }

  static async getMessages(conversationId: string): Promise<Message[]> {
    return this.msgRepo().find({
      where: { conversationId },
      order: { timestamp: 'ASC' },
    });
  }
}
