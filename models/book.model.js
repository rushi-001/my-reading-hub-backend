import mongoose from "mongoose";
import { randomUUID } from "crypto";

const bookmarkSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => randomUUID() },
    type: { type: String, default: "line", trim: true },
    page: { type: Number, default: 0, min: 0 },
    text: { type: String, default: "" },
    note: { type: String, default: "" },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false, versionKey: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => randomUUID() },
    name: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0, min: 0 },
    fileId: { type: String, default: null },
    url: { type: String, default: null },
    dataUrl: { type: String, default: "" },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false, versionKey: false }
);

const bookSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => randomUUID(),
    },
    title: { type: String, default: "", trim: true },
    author: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    cover: { type: String, default: null },
    coverStoragePath: { type: String, default: null },
    format: { type: String, default: "text", trim: true },
    fileUrl: { type: String, default: null },
    fileStoragePath: { type: String, default: null },
    audioUrl: { type: String, default: null },
    audioStoragePath: { type: String, default: null },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    currentPage: { type: Number, default: 0, min: 0 },
    totalPages: { type: Number, default: 0, min: 0 },
    tags: { type: [String], default: [] },
    groupId: { type: String, default: null },
    isFavorite: { type: Boolean, default: false },
    readingDates: { type: [String], default: [] },
    bookmarks: { type: [bookmarkSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    lastOpenedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

bookSchema.set("toJSON", {
  transform: (_, result) => {
    delete result._id;
    delete result.coverStoragePath;
    delete result.fileStoragePath;
    delete result.audioStoragePath;
    return result;
  },
});

export const BookModel = mongoose.model("Book", bookSchema);
