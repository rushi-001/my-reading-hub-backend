import { NoteModel } from "../models/note.model.js";
import { BaseRepository } from "./base.repository.js";

class NoteRepository extends BaseRepository {
  constructor() {
    super(NoteModel);
  }

  findByBookId(bookId) {
    return this.model.find({ bookId }).sort({ updatedAt: -1, createdAt: -1 });
  }
}

export const noteRepository = new NoteRepository();

