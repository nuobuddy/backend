type Settings = {
  botName: string
  welcomeMessage: string
  maxMessages: number
}

class SettingsService {

  private settings: Settings = {
    botName: "ChatBot",
    welcomeMessage: "Hello! How can I help you?",
    maxMessages: 100
  }

  getSettings(): Settings {
    return this.settings
  }

  updateSettings(newSettings: Partial<Settings>): Settings {
    this.settings = { ...this.settings, ...newSettings }
    return this.settings
  }

}

export const settingsService = new SettingsService()