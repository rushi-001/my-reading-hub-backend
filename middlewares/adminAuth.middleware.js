import ApiError from "../utils/apiError.js";
import { verifyAdminToken } from "../utils/adminAuthToken.js";
import { adminRepository } from "../repositories/admin.repository.js";
import { getAdminAuthCookieName } from "../utils/adminAuthCookie.js";

const getBearerToken = (authorizationHeader = "") => {
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token?.trim()) {
    return null;
  }

  return token.trim();
};

const getRequestAdminToken = (req) =>
  req.cookies?.[getAdminAuthCookieName()] ||
  getBearerToken(req.get("authorization") || "");

export const requireAdminAuth = async (req, _res, next) => {
  try {
    const token = getRequestAdminToken(req);
    if (!token) {
      throw new ApiError(
        401,
        "Admin authentication token is required",
        "Unauthorized"
      );
    }

    const payload = verifyAdminToken(token);
    const admin = await adminRepository.findById(payload.adminId);

    if (!admin || !admin.isActive) {
      throw new ApiError(401, "Admin account is not authorized", "Unauthorized");
    }

    if (Number(payload.tokenVersion || 0) !== Number(admin.tokenVersion || 0)) {
      throw new ApiError(401, "Admin token has been revoked", "Unauthorized");
    }

    req.admin = admin.toJSON();
    return next();
  } catch (error) {
    return next(
      error instanceof ApiError
        ? error
        : new ApiError(401, "Invalid or expired admin token", "Unauthorized")
    );
  }
};
