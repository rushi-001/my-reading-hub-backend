import { Router } from "express";
import { adminAuthController } from "../controllers/adminAuth.controller.js";
import { requireObjectBody } from "../middlewares/bodyValidation.middleware.js";
import { requireAdminAuth } from "../middlewares/adminAuth.middleware.js";

export class AdminAuthRoutes {
  constructor() {
    this.router = Router();
    this.registerRoutes();
  }

  registerRoutes() {
    this.router.post("/setup", requireObjectBody, adminAuthController.setupAdmin);
    this.router.post("/login", requireObjectBody, adminAuthController.login);
    this.router.get("/me", requireAdminAuth, adminAuthController.fetchProfile);
    this.router.post("/logout", requireAdminAuth, adminAuthController.logout);
  }
}
