import { Router } from "express";
import { settingsController } from "../controllers/settings.controller.js";
import { requireObjectBody } from "../middlewares/bodyValidation.middleware.js";

export class SettingsRoutes {
  constructor() {
    this.router = Router();
    this.registerRoutes();
  }

  registerRoutes() {
    this.router.get("/", settingsController.fetchSettings);
    this.router.put("/", requireObjectBody, settingsController.updateSettings);
  }
}

