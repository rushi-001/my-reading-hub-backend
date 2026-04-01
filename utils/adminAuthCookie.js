import { getAdminTokenMaxAgeMs } from "./adminAuthToken.js";

const DEFAULT_COOKIE_NAME = "admin_auth_token";

const normalizeSameSite = (value) => {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (normalizedValue === "strict") return "strict";
  if (normalizedValue === "none") return "none";
  return "lax";
};

const toBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalizedValue)) return true;
    if (["false", "0", "no", "n"].includes(normalizedValue)) return false;
  }

  return fallback;
};

export const getAdminAuthCookieName = () =>
  process.env.ADMIN_AUTH_COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME;

export const getAdminAuthCookieOptions = () => {
  const sameSite = normalizeSameSite(process.env.ADMIN_AUTH_COOKIE_SAME_SITE);
  const secure =
    sameSite === "none"
      ? true
      : toBoolean(
          process.env.ADMIN_AUTH_COOKIE_SECURE,
          process.env.NODE_ENV === "production"
        );

  return {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: getAdminTokenMaxAgeMs(),
  };
};

export const setAdminAuthCookie = (res, token) => {
  res.cookie(getAdminAuthCookieName(), token, getAdminAuthCookieOptions());
};

export const clearAdminAuthCookie = (res) => {
  res.clearCookie(getAdminAuthCookieName(), {
    ...getAdminAuthCookieOptions(),
    maxAge: undefined,
  });
};
