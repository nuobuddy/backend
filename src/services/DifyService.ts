import { AppDataSource } from '@/config/database';
import { env } from '@/config/env';
import { SystemSetting } from '@/entities/SystemSetting';

interface DifyConfig {
  apiKey: string;
  baseUrl: string;
}

export interface SendMessageStreamParams {
  query: string;
  user: string;
  conversationId?: string | null;
  inputs?: Record<string, unknown>;
}

export class DifyService {
  private static settingRepo = AppDataSource.getRepository(SystemSetting);

  private static async getSettingValue(key: string): Promise<string | null> {
    const setting = await this.settingRepo.findOne({
      where: { key },
    });

    const value = setting?.value?.trim();
    return value || null;
  }

  private static normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '');
  }

  private static async getConfig(): Promise<DifyConfig> {
    const [dbBaseUrl, dbApiKey] = await Promise.all([
      this.getSettingValue('dify_base_url'),
      this.getSettingValue('dify_api_key'),
    ]);

    const baseUrl = dbBaseUrl ?? env.dify.baseUrl;
    const apiKey = dbApiKey ?? env.dify.apiKey;

    if (!baseUrl || !apiKey) {
      throw new Error('Dify configuration is missing.');
    }

    return {
      apiKey,
      baseUrl: this.normalizeBaseUrl(baseUrl),
    };
  }

  static async sendMessageStream(params: SendMessageStreamParams): Promise<Response> {
    const config = await this.getConfig();

    const response = await fetch(`${config.baseUrl}/v1/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: params.inputs ?? {},
        query: params.query,
        response_mode: 'streaming',
        conversation_id: params.conversationId ?? undefined,
        user: params.user,
      }),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Dify request failed with status ${response.status}: ${errorText || 'Unknown error'}`);
    }

    return response;
  }
}
