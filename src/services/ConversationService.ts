import { AppDataSource } from '@/config/database';
import { Conversation } from '@/entities/Conversation';
import { Message } from '@/entities/Message';

export interface DailyConversationCountPoint {
  date: string;
  conversationCount: number;
}

export interface DailyConversationCountResult {
  from: string;
  to: string;
  points: DailyConversationCountPoint[];
}

export class ConversationService {
  // Lazy getters — called only after DataSource is initialized
  private static repo = () => AppDataSource.getRepository(Conversation);

  private static msgRepo = () => AppDataSource.getRepository(Message);

  private static readonly DAY_MS = 24 * 60 * 60 * 1000;

  private static formatUtcDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

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

  /**
   * Admin: Daily conversation count over a fixed number of days.
   */
  static async getDailyConversationCountForPastDays(
    days: number = 7,
  ): Promise<DailyConversationCountResult> {
    const now = new Date();
    const todayStart = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ));

    const fromDate = new Date(todayStart);
    fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));

    const rows = await this.repo()
      .createQueryBuilder('conversation')
      .select('DATE(conversation.createdAt AT TIME ZONE \'UTC\')', 'date')
      .addSelect('COUNT(*)', 'conversation_count')
      .where('conversation.createdAt >= :fromDate', { fromDate: fromDate.toISOString() })
      .andWhere('conversation.createdAt <= :toDate', { toDate: now.toISOString() })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; conversation_count: string }>();

    const countByDate = new Map<string, number>(
      rows.map((row) => [row.date, parseInt(row.conversation_count, 10) || 0]),
    );

    const points: DailyConversationCountPoint[] = [];
    let cursor = new Date(fromDate);

    while (cursor <= todayStart) {
      const date = this.formatUtcDate(cursor);
      points.push({
        date,
        conversationCount: countByDate.get(date) ?? 0,
      });

      cursor = new Date(cursor.getTime() + this.DAY_MS);
    }

    return {
      from: this.formatUtcDate(fromDate),
      to: this.formatUtcDate(now),
      points,
    };
  }

  /**
   * Admin: Total conversation count.
   */
  static async count(): Promise<number> {
    return this.repo().count();
  }
}
