import { Router } from "express";
import { githubSyncController } from "../controllers/githubSync.controller.js";
import { requireAdminAuth } from "../middlewares/adminAuth.middleware.js";

export class GithubSyncRoutes {
  constructor() {
    this.router = Router();
    this.registerRoutes();
  }

  registerRoutes() {
    this.router.use(requireAdminAuth);
    this.router.post("/push", githubSyncController.pushSnapshot);
    this.router.post("/pull", githubSyncController.pullSnapshot);
    this.router.get("/commits", githubSyncController.fetchCommits);
  }
}
