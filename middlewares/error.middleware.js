export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: "NotFound",
  });
};

export const errorHandler = (error, _req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  let statusCode = error.statusCode || 500;
  let message = error.message || "Internal server error";
  let errorType = error.error || "InternalServerError";

  if (error?.type === "entity.too.large" || error?.status === 413) {
    statusCode = 413;
    message =
      "Request payload is too large. Upload files with /api/files/upload and send the returned URLs in the book payload.";
    errorType = "PayloadTooLarge";
  }

  if (error?.name === "MulterError") {
    statusCode = error?.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    message =
      error?.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file is too large"
        : error.message || "File upload failed";
    errorType = "BadRequest";
  }

  if (error?.code === 11000) {
    statusCode = 409;
    const duplicateField = Object.keys(error.keyPattern || {})[0] || "resource";
    message = `${duplicateField} already exists`;
    errorType = "Conflict";
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: errorType,
  });
};
