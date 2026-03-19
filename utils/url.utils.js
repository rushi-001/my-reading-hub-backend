const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

const trimLeadingSlash = (value) => value.replace(/^\/+/, "");

export const isAbsoluteUrlLike = (value) =>
  typeof value === "string" && ABSOLUTE_URL_PATTERN.test(value.trim());

export const getRequestBaseUrl = (req) => {
  const configuredBaseUrl = process.env.BACKEND_BASE_URL

  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl.trim());
  }

  const forwardedProto = req?.headers?.["x-forwarded-proto"];
  const protocol = forwardedProto || req?.protocol || "http";
  const host = req?.get?.("host") || req?.headers?.host || "localhost:8484";

  return `${protocol}://${host}`;
};

export const toAbsoluteResourceUrl = (value, baseUrl) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed || isAbsoluteUrlLike(trimmed)) {
    return trimmed;
  }

  const normalizedBaseUrl = trimTrailingSlash(baseUrl || "");
  if (!normalizedBaseUrl) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${normalizedBaseUrl}${trimmed}`;
  }

  return `${normalizedBaseUrl}/${trimLeadingSlash(trimmed)}`;
};

const isUploadPath = (value) =>
  typeof value === "string" && value.trim().startsWith("/uploads/");

const toPathWithQueryAndHash = (url) =>
  `${url.pathname || ""}${url.search || ""}${url.hash || ""}`;

export const toStoredResourcePath = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (isUploadPath(trimmed)) {
    return trimmed;
  }

  if (!isAbsoluteUrlLike(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return trimmed;
    }

    const uploadPath = toPathWithQueryAndHash(parsed);
    return isUploadPath(uploadPath) ? uploadPath : trimmed;
  } catch {
    return trimmed;
  }
};

export const toPublicResourceUrl = (value, baseUrl) =>
  toAbsoluteResourceUrl(toStoredResourcePath(value), baseUrl);
