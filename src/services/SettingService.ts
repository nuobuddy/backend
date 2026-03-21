import { AppDataSource } from '../config/database';
import { SystemSetting } from '../entities/SystemSetting';

class SettingService {
  private static repo = AppDataSource.getRepository(SystemSetting);

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

  static async batchSet(entries: Record<string, string>): Promise<void> {
    const records = Object.entries(entries).map(([key, value]) => this.repo.create({ key, value }));

    await this.repo.save(records);
  }

  static async getAll(): Promise<SystemSetting[]> {
    return this.repo.find();
  }
}

export default SettingService;
