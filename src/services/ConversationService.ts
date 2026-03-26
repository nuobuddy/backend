import { Repository } from 'typeorm';
import { AppDataSource } from '@/config/database';
import { Conversation } from '@/entities/Conversation';

interface CreateConversationParams {
  userId: string;
  title?: string | null;
}

interface ListByUserParams {
  userId: string;
  page: number;
  limit: number;
}

interface ListByUserResult {
  conversations: Conversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ConversationService {
  private static get repo(): Repository<Conversation> {
    return AppDataSource.getRepository(Conversation);
  }

  static async create(params: CreateConversationParams): Promise<Conversation> {
    // Keep new conversations immediately usable by assigning a default title.
    const title = params.title?.trim() || 'New Chat';
    const conversation = this.repo.create({
      userId: params.userId,
      title,
      difyConversationId: null,
    });

    return this.repo.save(conversation);
  }

  static async findByIdAndUser(id: string, userId: string): Promise<Conversation | null> {
    return this.repo.findOne({
      where: { id, userId },
    });
  }

  static async updateDifyId(
    id: string,
    userId: string,
    difyConversationId: string,
  ): Promise<Conversation | null> {
    const conversation = await this.findByIdAndUser(id, userId);

    if (!conversation) {
      return null;
    }

    conversation.difyConversationId = difyConversationId;
    return this.repo.save(conversation);
  }

  static async listByUser(params: ListByUserParams): Promise<ListByUserResult> {
    // Use database-level pagination to keep the list endpoint efficient.
    const skip = (params.page - 1) * params.limit;
    const [conversations, total] = await this.repo.findAndCount({
      where: { userId: params.userId },
      order: { createdAt: 'DESC' },
      skip,
      take: params.limit,
    });

    return {
      conversations,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.limit)),
      },
    };
  }

  static async deleteByIdAndUser(id: string, userId: string): Promise<boolean> {
    const result = await this.repo.delete({ id, userId });
    return (result.affected ?? 0) > 0;
  }
}

export default ConversationService;
