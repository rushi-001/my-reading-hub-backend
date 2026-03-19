import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import multer from "multer";
import { UPLOADS_ROOT } from "../utils/fileStorage.js";

const MAX_BOOK_UPLOAD_FILE_SIZE_MB = Number(
  process.env.MAX_BOOK_UPLOAD_FILE_SIZE_MB || 50
);
const MAX_BOOK_UPLOAD_FILES = Number(process.env.MAX_BOOK_UPLOAD_FILES || 20);

const FIELD_TO_CATEGORY = {
  cover: "cover",
  contentFile: "book-file",
  file: "book-file",
  bookFile: "book-file",
  pdf: "book-file",
  epub: "book-file",
  audio: "audio",
  attachment: "attachment",
  attachments: "attachment",
};

const resolveCategoryByField = (fieldName) =>
  FIELD_TO_CATEGORY[fieldName] || "book-file";

const storage = multer.diskStorage({
  destination: (_req, file, callback) => {
    try {
      const category = resolveCategoryByField(file.fieldname);
      file.storageCategory = category;

      const targetDir = path.resolve(UPLOADS_ROOT, category);
      fs.mkdirSync(targetDir, { recursive: true });

      callback(null, targetDir);
    } catch (error) {
      callback(error);
    }
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const storedName = `${Date.now()}-${randomUUID()}${extension}`;
    callback(null, storedName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_BOOK_UPLOAD_FILE_SIZE_MB * 1024 * 1024,
    files: MAX_BOOK_UPLOAD_FILES,
  },
});

export const uploadBookFiles = upload.fields([
  { name: "cover", maxCount: 1 },
  { name: "contentFile", maxCount: 1 },
  { name: "file", maxCount: 1 },
  { name: "bookFile", maxCount: 1 },
  { name: "pdf", maxCount: 1 },
  { name: "epub", maxCount: 1 },
  { name: "audio", maxCount: 1 },
  { name: "attachments", maxCount: MAX_BOOK_UPLOAD_FILES },
]);

export const uploadBookAttachment = upload.single("attachment");
