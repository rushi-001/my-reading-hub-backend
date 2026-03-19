import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import ApiError from "../utils/apiError.js";
import { bookRepository } from "../repositories/book.repository.js";
import { hasOwn, isPlainObject } from "../utils/object.utils.js";
import { toPublicResourceUrl, toStoredResourcePath } from "../utils/url.utils.js";
import { UPLOADS_ROOT } from "../utils/fileStorage.js";
import {
  toBoolean,
  toDateOrNull,
  toNullableText,
  toNumber,
  toStringArray,
  toText,
} from "../utils/normalizers.js";

const DEFAULT_SEARCH_PAGE = 1;
const DEFAULT_SEARCH_PAGE_SIZE = 24;
const MAX_SEARCH_PAGE_SIZE = 100;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toNullableSearchText = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toSearchBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }

  return fallback;
};

const toSearchInt = (
  value,
  { fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY }
) => {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number.parseInt(value, 10)
      : Number.NaN;

  if (Number.isNaN(raw)) {
    return fallback;
  }

  if (raw < min) return min;
  if (raw > max) return max;
  return raw;
};

const buildSearchBookQuery = ({ query, format, favoritesOnly, groupId }) => {
  const dbQuery = {};

  if (query) {
    const escapedQuery = escapeRegex(query);
    const regex = new RegExp(escapedQuery, "i");

    dbQuery.$or = [
      { title: regex },
      { author: regex },
      { description: regex },
      { tags: regex },
      { groupId: regex },
    ];
  }

  if (format) {
    dbQuery.format = format;
  }

  if (favoritesOnly) {
    dbQuery.isFavorite = true;
  }

  if (groupId) {
    dbQuery.groupId = groupId;
  }

  return dbQuery;
};

const normalizeBookmark = (bookmark) => ({
  id: toText(bookmark?.id, randomUUID()),
  type: toText(bookmark?.type, "line"),
  page: toNumber(bookmark?.page, { fallback: 0, min: 0 }),
  text: toText(bookmark?.text, ""),
  note: toText(bookmark?.note, ""),
  createdAt: toDateOrNull(bookmark?.createdAt) || new Date(),
});

const normalizeAttachment = (attachment) => ({
  id: toText(attachment?.id, randomUUID()),
  name: toText(attachment?.name, ""),
  mimeType: toText(attachment?.mimeType, ""),
  size: toNumber(attachment?.size, { fallback: 0, min: 0 }),
  fileId: toNullableText(attachment?.fileId),
  url: toNullableText(toStoredResourcePath(attachment?.url)),
  dataUrl: toText(attachment?.dataUrl, ""),
  createdAt: toDateOrNull(attachment?.createdAt) || new Date(),
});

const normalizeBookmarks = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((bookmark) => isPlainObject(bookmark))
    .map(normalizeBookmark);
};

const normalizeAttachments = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((attachment) => isPlainObject(attachment))
    .map((attachment) => normalizeAttachment(attachment));
};

const buildCreatePayload = (payload) => ({
  id: toText(payload.id, randomUUID()),
  title: toText(payload.title, ""),
  author: toText(payload.author, ""),
  description: toText(payload.description, ""),
  cover: toNullableText(toStoredResourcePath(payload.cover)),
  format: toText(payload.format, "text"),
  fileUrl: toNullableText(toStoredResourcePath(payload.fileUrl)),
  audioUrl: toNullableText(toStoredResourcePath(payload.audioUrl)),
  rating: toNumber(payload.rating, { fallback: 0, min: 0, max: 5 }),
  progress: toNumber(payload.progress, { fallback: 0, min: 0, max: 100 }),
  currentPage: toNumber(payload.currentPage, { fallback: 0, min: 0 }),
  totalPages: toNumber(payload.totalPages, { fallback: 0, min: 0 }),
  tags: toStringArray(payload.tags),
  groupId: toNullableText(payload.groupId),
  isFavorite: toBoolean(payload.isFavorite, false),
  readingDates: toStringArray(payload.readingDates),
  bookmarks: normalizeBookmarks(payload.bookmarks),
  attachments: normalizeAttachments(payload.attachments),
  lastOpenedAt: toDateOrNull(payload.lastOpenedAt),
});

const buildPatchPayload = (patch) => {
  const update = {};

  if (hasOwn(patch, "title")) update.title = toText(patch.title, "");
  if (hasOwn(patch, "author")) update.author = toText(patch.author, "");
  if (hasOwn(patch, "description"))
    update.description = toText(patch.description, "");
  if (hasOwn(patch, "cover")) {
    update.cover = toNullableText(toStoredResourcePath(patch.cover));
  }
  if (hasOwn(patch, "format")) update.format = toText(patch.format, "text");
  if (hasOwn(patch, "fileUrl")) {
    update.fileUrl = toNullableText(toStoredResourcePath(patch.fileUrl));
  }
  if (hasOwn(patch, "audioUrl")) {
    update.audioUrl = toNullableText(toStoredResourcePath(patch.audioUrl));
  }
  if (hasOwn(patch, "rating"))
    update.rating = toNumber(patch.rating, { fallback: 0, min: 0, max: 5 });
  if (hasOwn(patch, "progress"))
    update.progress = toNumber(patch.progress, {
      fallback: 0,
      min: 0,
      max: 100,
    });
  if (hasOwn(patch, "currentPage"))
    update.currentPage = toNumber(patch.currentPage, { fallback: 0, min: 0 });
  if (hasOwn(patch, "totalPages"))
    update.totalPages = toNumber(patch.totalPages, { fallback: 0, min: 0 });
  if (hasOwn(patch, "tags")) update.tags = toStringArray(patch.tags);
  if (hasOwn(patch, "groupId")) update.groupId = toNullableText(patch.groupId);
  if (hasOwn(patch, "isFavorite"))
    update.isFavorite = toBoolean(patch.isFavorite, false);
  if (hasOwn(patch, "readingDates"))
    update.readingDates = toStringArray(patch.readingDates);
  if (hasOwn(patch, "bookmarks"))
    update.bookmarks = normalizeBookmarks(patch.bookmarks);
  if (hasOwn(patch, "attachments"))
    update.attachments = normalizeAttachments(patch.attachments);
  if (hasOwn(patch, "lastOpenedAt"))
    update.lastOpenedAt = toDateOrNull(patch.lastOpenedAt);

  return update;
};

const toUploadRelativePathFromResourceUrl = (resourceUrl) => {
  const storedPath = toStoredResourcePath(resourceUrl);
  if (typeof storedPath !== "string") {
    return null;
  }

  const trimmed = storedPath.trim();
  if (!trimmed.startsWith("/uploads/")) {
    return null;
  }

  const relativePath = trimmed
    .slice("/uploads/".length)
    .split("?")[0]
    .split("#")[0];

  return relativePath || null;
};

const resolveUploadAbsolutePath = (resourceUrl) => {
  const uploadRelativePath = toUploadRelativePathFromResourceUrl(resourceUrl);
  if (!uploadRelativePath) {
    return null;
  }

  const rootPath = path.resolve(UPLOADS_ROOT);
  const absolutePath = path.resolve(rootPath, uploadRelativePath);
  const relativeToRoot = path.relative(rootPath, absolutePath);

  if (
    !relativeToRoot ||
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot)
  ) {
    return null;
  }

  return absolutePath;
};

const safeDeleteUploadFileByResourceUrl = async (resourceUrl) => {
  const absolutePath = resolveUploadAbsolutePath(resourceUrl);
  if (!absolutePath) {
    return;
  }

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error(`Failed to delete uploaded file: ${absolutePath}`, error);
    }
  }
};

const removeResourceFiles = async (resourceUrls = []) => {
  const uniqueUrls = Array.from(
    new Set(
      resourceUrls
        .filter((url) => typeof url === "string")
        .map((url) => url.trim())
        .filter(Boolean)
    )
  );

  await Promise.all(uniqueUrls.map((url) => safeDeleteUploadFileByResourceUrl(url)));
};

const getAttachmentUrls = (attachments) =>
  Array.isArray(attachments)
    ? attachments
        .map((attachment) =>
          typeof attachment?.url === "string" ? attachment.url.trim() : ""
        )
        .filter(Boolean)
    : [];

const collectBookResourceUrls = (book) => [
  book?.cover,
  book?.fileUrl,
  book?.audioUrl,
  ...getAttachmentUrls(book?.attachments),
].filter((url) => typeof url === "string" && url.trim().length);

const collectRemovedAttachmentUrlsFromPatch = (existingBook, updatePayload) => {
  if (!hasOwn(updatePayload, "attachments")) {
    return [];
  }

  const previousAttachments = Array.isArray(existingBook?.attachments)
    ? existingBook.attachments
    : [];
  const nextAttachments = Array.isArray(updatePayload.attachments)
    ? updatePayload.attachments
    : [];

  const nextIds = new Set(
    nextAttachments
      .map((attachment) =>
        typeof attachment?.id === "string" ? attachment.id.trim() : ""
      )
      .filter(Boolean)
  );

  return previousAttachments
    .filter((attachment) => {
      const attachmentId =
        typeof attachment?.id === "string" ? attachment.id.trim() : "";
      return attachmentId && !nextIds.has(attachmentId);
    })
    .map((attachment) =>
      typeof attachment?.url === "string" ? attachment.url.trim() : ""
    )
    .filter(Boolean);
};

const collectReplacedTopLevelResourceUrls = (existingBook, updatePayload) =>
  ["cover", "fileUrl", "audioUrl"]
    .filter((fieldName) => hasOwn(updatePayload, fieldName))
    .map((fieldName) => {
      const previousValue = toNullableText(existingBook?.[fieldName]);
      const nextValue = toNullableText(updatePayload?.[fieldName]);

      if (!previousValue || previousValue === nextValue) {
        return null;
      }

      return previousValue;
    })
    .filter(Boolean);

const toBookResponseAttachment = (attachment, baseUrl) => {
  if (!attachment || typeof attachment !== "object") {
    return attachment;
  }

  return {
    ...attachment,
    url: toNullableText(toPublicResourceUrl(attachment.url, baseUrl)),
  };
};

const toPlainBook = (book) => {
  if (!book) {
    return null;
  }

  if (typeof book.toJSON === "function") {
    return book.toJSON();
  }

  return { ...book };
};

const toBookResponse = (book, baseUrl) => {
  const plainBook = toPlainBook(book);
  if (!plainBook) {
    return null;
  }

  return {
    ...plainBook,
    cover: toNullableText(toPublicResourceUrl(plainBook.cover, baseUrl)),
    fileUrl: toNullableText(toPublicResourceUrl(plainBook.fileUrl, baseUrl)),
    audioUrl: toNullableText(toPublicResourceUrl(plainBook.audioUrl, baseUrl)),
    attachments: Array.isArray(plainBook.attachments)
      ? plainBook.attachments.map((attachment) =>
          toBookResponseAttachment(attachment, baseUrl)
        )
      : [],
  };
};

const toBooksResponse = (books, baseUrl) =>
  Array.isArray(books)
    ? books.map((book) => toBookResponse(book, baseUrl))
    : [];

class BookService {
  async fetchBooks(baseUrl) {
    const books = await bookRepository.findAll();
    return toBooksResponse(books, baseUrl);
  }

  async fetchBookById(id, baseUrl) {
    if (!id || typeof id !== "string") {
      throw new ApiError(400, "Book id is required", "BadRequest");
    }

    const book = await bookRepository.findById(id);
    if (!book) {
      throw new ApiError(404, "Book not found", "NotFound");
    }

    return toBookResponse(book, baseUrl);
  }

  async searchBooks(rawSearch = {}, baseUrl) {
    const query = toNullableSearchText(rawSearch.query) || "";
    const format = toNullableSearchText(rawSearch.format);
    const groupId = toNullableSearchText(rawSearch.groupId);
    const favoritesOnly = toSearchBoolean(rawSearch.favoritesOnly, false);
    const page = toSearchInt(rawSearch.page, {
      fallback: DEFAULT_SEARCH_PAGE,
      min: 1,
    });
    const pageSize = toSearchInt(rawSearch.pageSize, {
      fallback: DEFAULT_SEARCH_PAGE_SIZE,
      min: 1,
      max: MAX_SEARCH_PAGE_SIZE,
    });

    const dbQuery = buildSearchBookQuery({
      query,
      format,
      favoritesOnly,
      groupId,
    });

    const [items, totalItems] = await Promise.all([
      bookRepository.findWithPagination({
        query: dbQuery,
        page,
        pageSize,
      }),
      bookRepository.countByQuery(dbQuery),
    ]);

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    return {
      items: toBooksResponse(items, baseUrl),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1 && totalPages > 0,
      },
      filters: {
        query,
        format,
        favoritesOnly,
        groupId,
      },
    };
  }

  async createBook(payload, baseUrl) {
    if (!isPlainObject(payload)) {
      throw new ApiError(400, "Invalid book payload", "BadRequest");
    }

    const bookToCreate = buildCreatePayload(payload);
    const book = await bookRepository.create(bookToCreate);
    return toBookResponse(book, baseUrl);
  }

  async updateBook(id, patch, baseUrl) {
    if (!id || typeof id !== "string") {
      throw new ApiError(400, "Book id is required", "BadRequest");
    }

    if (!isPlainObject(patch)) {
      throw new ApiError(400, "Invalid book patch payload", "BadRequest");
    }

    const updatePayload = buildPatchPayload(patch);
    if (!Object.keys(updatePayload).length) {
      throw new ApiError(400, "No valid fields provided to update", "BadRequest");
    }

    const existingBook = await bookRepository.findById(id);
    if (!existingBook) {
      throw new ApiError(404, "Book not found", "NotFound");
    }

    const resourceUrlsToDelete = [
      ...collectReplacedTopLevelResourceUrls(existingBook, updatePayload),
      ...collectRemovedAttachmentUrlsFromPatch(existingBook, updatePayload),
    ];

    const updatedBook = await bookRepository.updateById(id, updatePayload);
    if (!updatedBook) {
      throw new ApiError(404, "Book not found", "NotFound");
    }

    await removeResourceFiles(resourceUrlsToDelete);

    return toBookResponse(updatedBook, baseUrl);
  }

  async addBookAttachment(bookId, attachment, baseUrl) {
    if (!bookId || typeof bookId !== "string") {
      throw new ApiError(400, "Book id is required", "BadRequest");
    }

    if (!isPlainObject(attachment)) {
      throw new ApiError(400, "Invalid attachment payload", "BadRequest");
    }

    const attachmentToAdd = normalizeAttachment(attachment);
    const updatedBook = await bookRepository.updateById(bookId, {
      $push: { attachments: attachmentToAdd },
    });

    if (!updatedBook) {
      throw new ApiError(404, "Book not found", "NotFound");
    }

    return toBookResponse(updatedBook, baseUrl);
  }

  async deleteBookAttachment(bookId, attachmentId, baseUrl) {
    if (!bookId || typeof bookId !== "string") {
      throw new ApiError(400, "Book id is required", "BadRequest");
    }

    if (!attachmentId || typeof attachmentId !== "string") {
      throw new ApiError(400, "Attachment id is required", "BadRequest");
    }

    const existingBook = await bookRepository.findById(bookId);
    if (!existingBook) {
      throw new ApiError(404, "Book not found", "NotFound");
    }

    const attachmentToDelete = Array.isArray(existingBook.attachments)
      ? existingBook.attachments.find((attachment) => attachment?.id === attachmentId)
      : null;

    if (!attachmentToDelete) {
      throw new ApiError(404, "Attachment not found", "NotFound");
    }

    const updatedBook = await bookRepository.updateById(bookId, {
      $pull: { attachments: { id: attachmentId } },
    });

    if (!updatedBook) {
      throw new ApiError(404, "Book not found", "NotFound");
    }

    await removeResourceFiles([attachmentToDelete.url]);

    return toBookResponse(updatedBook, baseUrl);
  }

  async deleteBook(id) {
    if (!id || typeof id !== "string") {
      throw new ApiError(400, "Book id is required", "BadRequest");
    }

    const deletedBook = await bookRepository.deleteById(id);
    if (!deletedBook) {
      throw new ApiError(404, "Book not found", "NotFound");
    }

    await removeResourceFiles(collectBookResourceUrls(deletedBook));

    return deletedBook.id;
  }
}

export const bookService = new BookService();
