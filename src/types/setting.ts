export interface SettingUpsertItem {
  key: string;
  value: string;
  description?: string | null;
}

export interface DifySettingConfig {
  baseUrl: string;
  apiKey: string;
}
