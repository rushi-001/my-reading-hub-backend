import { settingsService } from "../services/settings.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

class SettingsController {
  fetchSettings = asyncHandler(async (_req, res) => {
    const settings = await settingsService.fetchSettings();
    res.status(200).json({ settings });
  });

  updateSettings = asyncHandler(async (req, res) => {
    const settings = await settingsService.updateSettings(req.body);
    res.status(200).json({ settings });
  });
}

export const settingsController = new SettingsController();

