import bcrypt from "bcryptjs";
import ApiError from "../utils/apiError.js";
import { adminRepository } from "../repositories/admin.repository.js";
import { isPlainObject } from "../utils/object.utils.js";
import { toText } from "../utils/normalizers.js";
import { signAdminToken } from "../utils/adminAuthToken.js";

const MIN_PASSWORD_LENGTH = 8;

const normalizeUsername = (value) => toText(value, "").toLowerCase();

const normalizePassword = (value) =>
  typeof value === "string" ? value.trim() : "";

const toAdminAuthResponse = (admin) => ({
  admin: admin.toJSON(),
  token: signAdminToken(admin),
});

class AdminAuthService {
  async setupAdmin(payload) {
    if (!isPlainObject(payload)) {
      throw new ApiError(400, "Invalid admin setup payload", "BadRequest");
    }

    const existingAdminsCount = await adminRepository.countAdmins();
    if (existingAdminsCount > 0) {
      throw new ApiError(
        409,
        "Admin account is already configured",
        "Conflict"
      );
    }

    const username = normalizeUsername(payload.username) || "admin";
    const password = normalizePassword(payload.password);
    const name = toText(payload.name, "Admin");

    if (!username) {
      throw new ApiError(400, "username is required", "BadRequest");
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(
        400,
        `password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
        "BadRequest"
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await adminRepository.create({
      username,
      name,
      passwordHash,
      role: "admin",
    });

    return toAdminAuthResponse(admin);
  }

  async login(payload) {
    if (!isPlainObject(payload)) {
      throw new ApiError(400, "Invalid login payload", "BadRequest");
    }

    const username = normalizeUsername(payload.username);
    const password = normalizePassword(payload.password);

    if (!password) {
      throw new ApiError(400, "password is required", "BadRequest");
    }

    const admin = username
      ? await adminRepository.findByUsername(username)
      : await adminRepository.findSingleAdmin();

    if (!admin) {
      throw new ApiError(
        404,
        "Admin account is not configured yet. Call setup first.",
        "NotFound"
      );
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatches) {
      throw new ApiError(401, "Invalid username or password", "Unauthorized");
    }

    const updatedAdmin =
      (await adminRepository.updateById(admin.id, {
        lastLoginAt: new Date(),
      })) || admin;

    return toAdminAuthResponse(updatedAdmin);
  }

  async fetchProfile(adminId) {
    if (!adminId || typeof adminId !== "string") {
      throw new ApiError(400, "Admin id is required", "BadRequest");
    }

    const admin = await adminRepository.findById(adminId);
    if (!admin) {
      throw new ApiError(404, "Admin account not found", "NotFound");
    }

    return admin.toJSON();
  }

  async logout(adminId) {
    if (!adminId || typeof adminId !== "string") {
      throw new ApiError(400, "Admin id is required", "BadRequest");
    }

    const updatedAdmin = await adminRepository.updateById(adminId, {
      $inc: { tokenVersion: 1 },
    });

    if (!updatedAdmin) {
      throw new ApiError(404, "Admin account not found", "NotFound");
    }

    return { success: true };
  }
}

export const adminAuthService = new AdminAuthService();
