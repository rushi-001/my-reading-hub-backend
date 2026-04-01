import jwt from "jsonwebtoken";
import ApiError from "./apiError.js";

const DEVELOPMENT_JWT_SECRET = "development-jwt-secret-change-me";

const getJwtSecret = () => {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new ApiError(
      500,
      "JWT_SECRET is not configured",
      "ServerMisconfigured"
    );
  }

  return DEVELOPMENT_JWT_SECRET;
};

export const getAdminTokenMaxAgeMs = () => {
  const expiresIn = process.env.JWT_EXPIRES_IN?.trim() || "7d";
  const numericValue = Number.parseInt(expiresIn, 10);

  if (Number.isNaN(numericValue) || numericValue <= 0) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  if (/^\d+$/.test(expiresIn)) {
    return numericValue * 1000;
  }

  const unit = expiresIn.slice(String(numericValue).length).trim().toLowerCase();

  if (unit === "s") return numericValue * 1000;
  if (unit === "m") return numericValue * 60 * 1000;
  if (unit === "h") return numericValue * 60 * 60 * 1000;
  if (unit === "d") return numericValue * 24 * 60 * 60 * 1000;

  return 7 * 24 * 60 * 60 * 1000;
};

export const signAdminToken = (admin) =>
  jwt.sign(
    {
      adminId: admin.id,
      username: admin.username,
      role: admin.role || "admin",
      tokenVersion: Number(admin.tokenVersion || 0),
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );

export const verifyAdminToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    throw new ApiError(401, "Invalid or expired admin token", "Unauthorized");
  }
};
