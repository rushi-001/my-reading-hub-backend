import { APP_SETTINGS_KEY, SettingsModel } from "../models/settings.model.js";

class SettingsRepository {
  findAppSettings() {
    return SettingsModel.findOne({ key: APP_SETTINGS_KEY });
  }

  upsertAppSettings(update) {
    return SettingsModel.findOneAndUpdate(
      { key: APP_SETTINGS_KEY },
      { ...update, key: APP_SETTINGS_KEY },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );
  }
}

export const settingsRepository = new SettingsRepository();

