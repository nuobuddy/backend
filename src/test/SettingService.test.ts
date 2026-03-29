import SettingService from '@/services/SettingService';

const mockRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
};

jest.mock('@/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => mockRepo),
  },
}));

describe('SettingService', () => {
  describe('get', () => {
    it('returns default value when setting is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await SettingService.get('nonexistent-key', 'default-value');
      expect(result).toBe('default-value');
    });
    it('returns setting value when setting is found', async () => {
      mockRepo.findOne.mockResolvedValue({ key: 'existing-key', value: 'existing-value' });
      const result = await SettingService.get('existing-key', 'default-value');
      expect(result).toBe('existing-value');
    });
  });
  describe('batchSet', () => {
    it('creates and saves multiple settings', async () => {
      const entries = {
        key1: 'value1',
        key2: 'value2',
      };
      const createdRecords = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ];
      mockRepo.create.mockImplementation(({ key, value }) => ({ key, value }));
      await SettingService.batchSet(entries);
      expect(mockRepo.create).toHaveBeenCalledTimes(2);
      expect(mockRepo.create).toHaveBeenCalledWith({ key: 'key1', value: 'value1' });
      expect(mockRepo.create).toHaveBeenCalledWith({ key: 'key2', value: 'value2' });
      expect(mockRepo.save).toHaveBeenCalledWith(createdRecords);
    });
  });
  describe('getAll', () => {
    it('returns all settings', async () => {
      const settings = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ];
      mockRepo.find.mockResolvedValue(settings);
      const result = await SettingService.getAll();
      expect(result).toBe(settings);
    });
    it('returns empty array when no settings are found', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await SettingService.getAll();
      expect(result).toEqual([]);
    });
  });
});
