import { Router } from "express";
import { noteController } from "../controllers/note.controller.js";
import { requireObjectBody } from "../middlewares/bodyValidation.middleware.js";

export class NoteRoutes {
  constructor() {
    this.router = Router();
    this.registerRoutes();
  }

  registerRoutes() {
    this.router.get("/", noteController.fetchNotes);
    this.router.post("/", requireObjectBody, noteController.createNote);
    this.router.patch("/:id", requireObjectBody, noteController.updateNote);
    this.router.delete("/:id", noteController.deleteNote);
  }
}

