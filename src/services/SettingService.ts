import { Repository } from 'typeorm';
import { AppDataSource } from '@/config/database';
import { env } from '@/config/env';
import { SystemSetting } from '@/entities/SystemSetting';
import { DifySettingConfig, SettingUpsertItem } from '@/types/setting';

interface StringReadOptions {
  defaultValue?: string;
  fallbackValue?: string;
  trim?: boolean;
}

interface BooleanReadOptions {
  defaultValue?: boolean;
  fallbackValue?: boolean;
}

interface NumberReadOptions {
  defaultValue?: number;
  fallbackValue?: number;
}

class SettingService {
  /**
   * 使用 getter 获取仓库，避免在模块加载时过早固化引用。
   */
  private static get repo(): Repository<SystemSetting> {
    return AppDataSource.getRepository(SystemSetting);
  }

  /**
   * 保留旧接口行为：
   * - 仅在 key 不存在时返回 defaultValue
   * - 不对值做 trim 或空字符串兜底处理
   */
  static async get(
    key: string,
    defaultValue?: string,
  ): Promise<string | undefined> {
    const setting = await this.repo.findOne({ where: { key } });

    if (!setting) {
      return defaultValue;
    }

    return setting.value;
  }

  /**
   * 读取字符串设置，并支持数据库失败或未配置时的 fallback。
   */
  static async getString(
    key: string,
    options: StringReadOptions = {},
  ): Promise<string | undefined> {
    const { defaultValue, fallbackValue, trim = true } = options;

    try {
      const setting = await this.repo.findOne({ where: { key } });
      const normalizedSetting = this.normalizeString(setting?.value, trim);

      if (normalizedSetting !== undefined) {
        return normalizedSetting;
      }
    } catch {
      return this.normalizeString(fallbackValue ?? defaultValue, trim);
    }

    return this.normalizeString(fallbackValue ?? defaultValue, trim);
  }

  /**
   * 读取必填字符串设置。
   * 当数据库和 fallback 都没有可用值时，抛出明确错误，便于上层快速定位配置问题。
   */
  static async getRequiredString(
    key: string,
    options: StringReadOptions = {},
  ): Promise<string> {
    const value = await this.getString(key, options);

    if (!value) {
      throw new Error(`Setting "${key}" is required`);
    }

    return value;
  }

  /**
   * 读取布尔值设置，支持 true/false、1/0、yes/no、on/off。
   */
  static async getBoolean(
    key: string,
    options: BooleanReadOptions = {},
  ): Promise<boolean | undefined> {
    const value = await this.getString(key, {
      defaultValue: this.formatPrimitive(options.defaultValue),
      fallbackValue: this.formatPrimitive(options.fallbackValue),
    });

    if (value === undefined) {
      return undefined;
    }

    const normalized = value.toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }

    throw new Error(`Setting "${key}" must be a boolean`);
  }

  /**
   * 读取数值设置，并在值非法时抛出错误。
   */
  static async getNumber(
    key: string,
    options: NumberReadOptions = {},
  ): Promise<number | undefined> {
    const value = await this.getString(key, {
      defaultValue: this.formatPrimitive(options.defaultValue),
      fallbackValue: this.formatPrimitive(options.fallbackValue),
    });

    if (value === undefined) {
      return undefined;
    }

    const parsed = Number(value);

    if (Number.isNaN(parsed)) {
      throw new Error(`Setting "${key}" must be a valid number`);
    }

    return parsed;
  }

  /**
   * 读取 JSON 配置，适合后续扩展复杂结构配置。
   */
  static async getJson<T>(
    key: string,
    options: StringReadOptions = {},
  ): Promise<T | undefined> {
    const value = await this.getString(key, options);

    if (value === undefined) {
      return undefined;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      throw new Error(`Setting "${key}" must be valid JSON`);
    }
  }

  /**
   * 兼容旧批量写接口。
   */
  static async batchSet(entries: Record<string, string>): Promise<void> {
    const records = Object.entries(entries).map(([key, value]) => this.repo.create({ key, value }));

    await this.repo.save(records);
  }

  /**
   * 新的批量 upsert 接口，支持 description 字段，适合后台设置页或初始化脚本。
   */
  static async upsertMany(entries: SettingUpsertItem[]): Promise<void> {
    const records = entries.map((entry) => this.repo.create({
      key: entry.key,
      value: entry.value,
      description: entry.description ?? null,
    }));

    await this.repo.save(records);
  }

  /**
   * 写入单条设置，便于业务层显式更新某个 key。
   */
  static async set(
    key: string,
    value: string,
    description?: string | null,
  ): Promise<void> {
    await this.upsertMany([{ key, value, description }]);
  }

  /**
   * 按前缀读取设置，适合按业务域加载配置，例如 dify.*。
   */
  static async getByPrefix(prefix: string): Promise<Record<string, string>> {
    const settings = await this.repo
      .createQueryBuilder('setting')
      .where('setting.key LIKE :prefix', { prefix: `${prefix}%` })
      .getMany();

    return settings.reduce<Record<string, string>>((accumulator, setting) => {
      accumulator[setting.key] = setting.value;
      return accumulator;
    }, {});
  }

  /**
   * Dify 专用配置读取。
   * 优先读数据库，数据库缺失或暂时不可用时再退回 env 兜底。
   */
  static async getDifyConfig(): Promise<DifySettingConfig> {
    const baseUrl = await this.getRequiredString('dify.base_url', {
      defaultValue: 'https://api.dify.ai',
      fallbackValue: env.dify.baseUrl,
    });
    const apiKey = await this.getRequiredString('dify.api_key', {
      fallbackValue: env.dify.apiKey,
    });

    return { baseUrl, apiKey };
  }

  /**
   * Dify 专用配置写入，避免业务层散落 dify.* 字符串常量。
   */
  static async setDifyConfig(config: Partial<DifySettingConfig>): Promise<void> {
    const entries: SettingUpsertItem[] = [];

    if (config.baseUrl !== undefined) {
      entries.push({
        key: 'dify.base_url',
        value: config.baseUrl,
        description: 'Dify API base URL',
      });
    }

    if (config.apiKey !== undefined) {
      entries.push({
        key: 'dify.api_key',
        value: config.apiKey,
        description: 'Dify API key',
      });
    }

    if (!entries.length) {
      return;
    }

    await this.upsertMany(entries);
  }

  static async getAll(): Promise<SystemSetting[]> {
    return this.repo.find();
  }

  private static normalizeString(
    value: string | undefined,
    trim = true,
  ): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    const normalized = trim ? value.trim() : value;
    return normalized === '' ? undefined : normalized;
  }

  private static formatPrimitive(value: boolean | number | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    return String(value);
  }
}

export default SettingService;
