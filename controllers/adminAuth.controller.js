import { adminAuthService } from "../services/adminAuth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  clearAdminAuthCookie,
  setAdminAuthCookie,
} from "../utils/adminAuthCookie.js";

class AdminAuthController {
  setupAdmin = asyncHandler(async (req, res) => {
    const result = await adminAuthService.setupAdmin(req.body);
    setAdminAuthCookie(res, result.token);
    res.status(201).json(result);
  });

  login = asyncHandler(async (req, res) => {
    const result = await adminAuthService.login(req.body);
    setAdminAuthCookie(res, result.token);
    res.status(200).json(result);
  });

  fetchProfile = asyncHandler(async (req, res) => {
    const admin = await adminAuthService.fetchProfile(req.admin.id);
    res.status(200).json({ admin });
  });

  logout = asyncHandler(async (_req, res) => {
    await adminAuthService.logout(_req.admin.id);
    clearAdminAuthCookie(res);
    res.status(200).json({ success: true });
  });
}

export const adminAuthController = new AdminAuthController();
