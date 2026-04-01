const decodeCookieValue = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const parseCookieHeader = (cookieHeader) => {
  if (typeof cookieHeader !== "string" || !cookieHeader.trim()) {
    return {};
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, cookiePart) => {
      const separatorIndex = cookiePart.indexOf("=");
      if (separatorIndex <= 0) {
        return cookies;
      }

      const key = cookiePart.slice(0, separatorIndex).trim();
      const value = cookiePart.slice(separatorIndex + 1).trim();

      if (!key) {
        return cookies;
      }

      cookies[key] = decodeCookieValue(value);
      return cookies;
    }, {});
};

export const attachRequestCookies = (req, _res, next) => {
  req.cookies = parseCookieHeader(req.headers?.cookie || "");
  next();
};
