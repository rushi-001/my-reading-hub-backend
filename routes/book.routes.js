import { Router } from "express";
import { bookController } from "../controllers/book.controller.js";
import { requireObjectBody } from "../middlewares/bodyValidation.middleware.js";
import {
  uploadBookAttachment,
  uploadBookFiles,
} from "../middlewares/bookUpload.middleware.js";

export class BookRoutes {
  constructor() {
    this.router = Router();
    this.registerRoutes();
  }

  registerRoutes() {
    this.router.get("/", bookController.fetchBooks);
    this.router.get("/search", bookController.searchBooks);
    this.router.get("/:id", bookController.fetchBookById);
    this.router.post(
      "/:bookId/attachments",
      uploadBookAttachment,
      bookController.uploadBookAttachment
    );
    this.router.delete(
      "/:bookId/attachments/:attachmentId",
      bookController.deleteBookAttachment
    );
    this.router.post("/", uploadBookFiles, requireObjectBody, bookController.createBook);
    this.router.patch(
      "/:id",
      uploadBookFiles,
      requireObjectBody,
      bookController.updateBook
    );
    this.router.delete("/:id", bookController.deleteBook);
  }
}
