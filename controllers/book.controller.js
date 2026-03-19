import { bookService } from "../services/book.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import { randomUUID } from "crypto";
import { buildPublicFileUrl } from "../utils/fileStorage.js";
import { getRequestBaseUrl } from "../utils/url.utils.js";
import { isPlainObject } from "../utils/object.utils.js";

const asArray = (value) => (Array.isArray(value) ? value : []);

const parseIfJsonString = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  const isJsonLike =
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"));

  if (!isJsonLike) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const normalizeMultipartBookBody = (body) => {
  const payload = { ...body };

  ["tags", "readingDates", "bookmarks", "attachments"].forEach((fieldName) => {
    if (fieldName in payload) {
      payload[fieldName] = parseIfJsonString(payload[fieldName]);
    }
  });

  return payload;
};

const unwrapMultipartPayload = (body, payloadField) => {
  const source = isPlainObject(body) ? body : {};
  const rawPayload = parseIfJsonString(source[payloadField]);
  const { [payloadField]: _ignored, ...remainingBody } = source;

  if (!isPlainObject(rawPayload)) {
    return remainingBody;
  }

  // Explicit multipart payload field wins over ad-hoc top-level values.
  return { ...remainingBody, ...rawPayload };
};

const buildUploadedFileUrl = (file) => {
  const category = file.storageCategory || "book-file";
  return buildPublicFileUrl(`${category}/${file.filename}`);
};

const toAttachmentFromFile = (file) => ({
  id: randomUUID(),
  name: file.originalname || file.filename || "attachment",
  mimeType: file.mimetype || "application/octet-stream",
  size: Number(file.size || 0),
  fileId: null,
  url: buildUploadedFileUrl(file),
  dataUrl: "",
  createdAt: new Date(),
});

const getFirstUploadedFile = (filesMap, fieldNames) => {
  for (const fieldName of fieldNames) {
    const file = asArray(filesMap?.[fieldName])[0];
    if (file) return file;
  }

  return null;
};

const mergeBodyAndUploadedFiles = (body, filesMap, payloadField) => {
  const payload = normalizeMultipartBookBody(
    unwrapMultipartPayload(body, payloadField)
  );

  const coverFile = getFirstUploadedFile(filesMap, ["cover"]);
  const mainBookFile = getFirstUploadedFile(filesMap, [
    "contentFile",
    "file",
    "bookFile",
    "pdf",
    "epub",
  ]);
  const audioFile = getFirstUploadedFile(filesMap, ["audio"]);
  const attachmentFiles = asArray(filesMap?.attachments);

  if (coverFile) {
    payload.cover = buildUploadedFileUrl(coverFile);
  }

  if (mainBookFile) {
    payload.fileUrl = buildUploadedFileUrl(mainBookFile);
  }

  if (audioFile) {
    payload.audioUrl = buildUploadedFileUrl(audioFile);
  }

  if (attachmentFiles.length) {
    const existingAttachments = asArray(payload.attachments);
    payload.attachments = [
      ...existingAttachments,
      ...attachmentFiles.map((file) => toAttachmentFromFile(file)),
    ];
  }

  return payload;
};

class BookController {
  fetchBooks = asyncHandler(async (req, res) => {
    const baseUrl = getRequestBaseUrl(req);
    const books = await bookService.fetchBooks(baseUrl);
    res.status(200).json({ books });
  });

  fetchBookById = asyncHandler(async (req, res) => {
    const baseUrl = getRequestBaseUrl(req);
    const book = await bookService.fetchBookById(req.params.id, baseUrl);
    res.status(200).json({ book });
  });

  searchBooks = asyncHandler(async (req, res) => {
    const baseUrl = getRequestBaseUrl(req);
    const result = await bookService.searchBooks(req.query, baseUrl);
    res.status(200).json(result);
  });

  createBook = asyncHandler(async (req, res) => {
    const baseUrl = getRequestBaseUrl(req);
    const payload = mergeBodyAndUploadedFiles(req.body, req.files, "book");
    const book = await bookService.createBook(payload, baseUrl);
    res.status(201).json({ book });
  });

  updateBook = asyncHandler(async (req, res) => {
    const baseUrl = getRequestBaseUrl(req);
    const payload = mergeBodyAndUploadedFiles(req.body, req.files, "patch");
    const book = await bookService.updateBook(
      req.params.id,
      payload,
      baseUrl
    );
    res.status(200).json({ book });
  });

  uploadBookAttachment = asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      throw new ApiError(
        400,
        "No attachment uploaded. Use field name 'attachment'.",
        "BadRequest"
      );
    }

    const baseUrl = getRequestBaseUrl(req);
    const attachment = toAttachmentFromFile(file);
    const book = await bookService.addBookAttachment(
      req.params.bookId,
      attachment,
      baseUrl
    );
    res.status(200).json({ book });
  });

  deleteBookAttachment = asyncHandler(async (req, res) => {
    const baseUrl = getRequestBaseUrl(req);
    const book = await bookService.deleteBookAttachment(
      req.params.bookId,
      req.params.attachmentId,
      baseUrl
    );
    res.status(200).json({ book });
  });

  deleteBook = asyncHandler(async (req, res) => {
    const deletedId = await bookService.deleteBook(req.params.id);
    res.status(200).json({ success: true, deletedId });
  });
}

export const bookController = new BookController();
