import ApiError from "../utils/apiError.js";
import { settingsRepository } from "../repositories/settings.repository.js";
import { isPlainObject } from "../utils/object.utils.js";
import {
  buildSettingsBackfillPatch,
  buildSettingsPayload,
} from "../utils/settings.utils.js";

class SettingsService {
  async fetchSettings() {
    const existingSettings = await settingsRepository.findAppSettings();
    if (existingSettings) {
      const compatibilityPatch = buildSettingsBackfillPatch(existingSettings);
      if (Object.keys(compatibilityPatch).length) {
        return settingsRepository.upsertAppSettings(compatibilityPatch);
      }

      return existingSettings;
    }

    return settingsRepository.upsertAppSettings({});
  }

  async updateSettings(payload) {
    if (!isPlainObject(payload)) {
      throw new ApiError(400, "Invalid settings payload", "BadRequest");
    }

    const normalizedSettings = buildSettingsPayload(payload);
    return settingsRepository.upsertAppSettings(normalizedSettings);
  }
}

export const settingsService = new SettingsService();
