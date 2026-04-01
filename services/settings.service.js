import ApiError from "../utils/apiError.js";
import { settingsRepository } from "../repositories/settings.repository.js";
import { isPlainObject } from "../utils/object.utils.js";
import { toBoolean, toNumber, toText } from "../utils/normalizers.js";

const ALLOWED_COMMAND_PALETTE_POSITIONS = new Set([
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center-center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

const normalizeCommandPalettePosition = (value) => {
  const position = toText(value, "top-center");
  return ALLOWED_COMMAND_PALETTE_POSITIONS.has(position)
    ? position
    : "top-center";
};

const buildSettingsPayload = (payload) => ({
  showIcons: toBoolean(payload.showIcons, true),
  commandPalettePosition: normalizeCommandPalettePosition(
    payload.commandPalettePosition
  ),
  stackGroups: toBoolean(payload.stackGroups, false),
  stackMaxVisible: toNumber(payload.stackMaxVisible, {
    fallback: 3,
    min: 0,
    max: 20,
  }),
  autoScrollSpeed: toNumber(payload.autoScrollSpeed, {
    fallback: 0,
    min: 0,
    max: 100,
  }),
  sidebarVisible: toBoolean(payload.sidebarVisible, true),
  collapsibleSidebar: toBoolean(payload.collapsibleSidebar, false),
  showCalendarHeatmap: toBoolean(payload.showCalendarHeatmap, true),
});

class SettingsService {
  async fetchSettings() {
    const existingSettings = await settingsRepository.findAppSettings();
    if (existingSettings) {
      if (typeof existingSettings.collapsibleSidebar !== "boolean") {
        return settingsRepository.upsertAppSettings({
          collapsibleSidebar: false,
        });
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
