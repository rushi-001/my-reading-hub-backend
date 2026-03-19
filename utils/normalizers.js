export const toText = (value, fallback = "") => {
  if (typeof value === "string") {
    return value.trim();
  }

  return fallback;
};

export const toNullableText = (value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  return null;
};

export const toStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

export const toBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

export const toNumber = (
  value,
  { fallback = 0, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}
) => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value.trim())
      : Number.NaN;

  if (Number.isNaN(numericValue)) {
    return fallback;
  }

  if (numericValue < min) return min;
  if (numericValue > max) return max;
  return numericValue;
};

export const toDateOrNull = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
