import { bookService } from "../services/book.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import { randomUUID } from "crypto";
import { getRequestBaseUrl } from "../utils/url.utils.js";
import { isPlainObject } from "../utils/object.utils.js";
import {
  deleteStoredResources,
  storeUploadedFile,
} from "../utils/resourceStorage.js";

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

const toAttachmentFromStoredFile = (file, storedFile) => ({
  id: randomUUID(),
  name: file.originalname || file.filename || "attachment",
  mimeType: file.mimetype || "application/octet-stream",
  size: Number(file.size || 0),
  fileId: storedFile.storagePath,
  url: storedFile.url,
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

const rollbackUploadedResources = async (uploadedResources = []) => {
  try {
    await deleteStoredResources(uploadedResources);
  } catch (error) {
    console.error("Failed to roll back uploaded resources", error);
  }
};

const uploadAndTrackFile = async (file, uploadedResources) => {
  const storedFile = await storeUploadedFile(file);
  uploadedResources.push(storedFile);
  return storedFile;
};

const mergeBodyAndUploadedFiles = async (body, filesMap, payloadField) => {
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
  const uploadedResources = [];

  try {
    if (coverFile) {
      const storedCover = await uploadAndTrackFile(coverFile, uploadedResources);
      payload.cover = storedCover.url;
      payload.coverStoragePath = storedCover.storagePath;
    }

    if (mainBookFile) {
      const storedBookFile = await uploadAndTrackFile(
        mainBookFile,
        uploadedResources
      );
      payload.fileUrl = storedBookFile.url;
      payload.fileStoragePath = storedBookFile.storagePath;
    }

    if (audioFile) {
      const storedAudioFile = await uploadAndTrackFile(audioFile, uploadedResources);
      payload.audioUrl = storedAudioFile.url;
      payload.audioStoragePath = storedAudioFile.storagePath;
    }

    if (attachmentFiles.length) {
      const existingAttachments = asArray(payload.attachments);
      const uploadedAttachments = [];

      for (const file of attachmentFiles) {
        const storedAttachment = await uploadAndTrackFile(file, uploadedResources);
        uploadedAttachments.push(
          toAttachmentFromStoredFile(file, storedAttachment)
        );
      }

      payload.attachments = [...existingAttachments, ...uploadedAttachments];
    }

    return { payload, uploadedResources };
  } catch (error) {
    await rollbackUploadedResources(uploadedResources);
    throw error;
  }
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
    const { payload, uploadedResources } = await mergeBodyAndUploadedFiles(
      req.body,
      req.files,
      "book"
    );

    try {
      const book = await bookService.createBook(payload, baseUrl);
      res.status(201).json({ book });
    } catch (error) {
      await rollbackUploadedResources(uploadedResources);
      throw error;
    }
  });

  updateBook = asyncHandler(async (req, res) => {
    const baseUrl = getRequestBaseUrl(req);
    const { payload, uploadedResources } = await mergeBodyAndUploadedFiles(
      req.body,
      req.files,
      "patch"
    );

    try {
      const book = await bookService.updateBook(
        req.params.id,
        payload,
        baseUrl
      );
      res.status(200).json({ book });
    } catch (error) {
      await rollbackUploadedResources(uploadedResources);
      throw error;
    }
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
    const storedFile = await storeUploadedFile(file);
    const attachment = toAttachmentFromStoredFile(file, storedFile);

    try {
      const book = await bookService.addBookAttachment(
        req.params.bookId,
        attachment,
        baseUrl
      );
      res.status(200).json({ book });
    } catch (error) {
      await rollbackUploadedResources([storedFile]);
      throw error;
    }
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
