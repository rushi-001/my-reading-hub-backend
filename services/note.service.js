import { randomUUID } from "crypto";
import ApiError from "../utils/apiError.js";
import { bookRepository } from "../repositories/book.repository.js";
import { noteRepository } from "../repositories/note.repository.js";
import { hasOwn, isPlainObject } from "../utils/object.utils.js";
import { toText } from "../utils/normalizers.js";

const buildCreatePayload = (payload) => ({
  id: toText(payload.id, randomUUID()),
  bookId: toText(payload.bookId, ""),
  title: toText(payload.title, ""),
  content: toText(payload.content, ""),
});

const buildPatchPayload = (patch) => {
  const update = {};

  if (hasOwn(patch, "bookId")) update.bookId = toText(patch.bookId, "");
  if (hasOwn(patch, "title")) update.title = toText(patch.title, "");
  if (hasOwn(patch, "content")) update.content = toText(patch.content, "");

  return update;
};

class NoteService {
  async fetchNotes() {
    return noteRepository.findAll();
  }

  async createNote(payload) {
    if (!isPlainObject(payload)) {
      throw new ApiError(400, "Invalid note payload", "BadRequest");
    }

    const noteToCreate = buildCreatePayload(payload);
    if (!noteToCreate.bookId) {
      throw new ApiError(400, "bookId is required", "BadRequest");
    }

    const book = await bookRepository.findById(noteToCreate.bookId);
    if (!book) {
      throw new ApiError(404, "Book for this note was not found", "NotFound");
    }

    return noteRepository.create(noteToCreate);
  }

  async updateNote(id, patch) {
    if (!id || typeof id !== "string") {
      throw new ApiError(400, "Note id is required", "BadRequest");
    }

    if (!isPlainObject(patch)) {
      throw new ApiError(400, "Invalid note patch payload", "BadRequest");
    }

    const updatePayload = buildPatchPayload(patch);
    if (!Object.keys(updatePayload).length) {
      throw new ApiError(400, "No valid fields provided to update", "BadRequest");
    }

    if (updatePayload.bookId) {
      const book = await bookRepository.findById(updatePayload.bookId);
      if (!book) {
        throw new ApiError(404, "Book for this note was not found", "NotFound");
      }
    }

    const updatedNote = await noteRepository.updateById(id, updatePayload);
    if (!updatedNote) {
      throw new ApiError(404, "Note not found", "NotFound");
    }

    return updatedNote;
  }

  async deleteNote(id) {
    if (!id || typeof id !== "string") {
      throw new ApiError(400, "Note id is required", "BadRequest");
    }

    const deletedNote = await noteRepository.deleteById(id);
    if (!deletedNote) {
      throw new ApiError(404, "Note not found", "NotFound");
    }

    return deletedNote.id;
  }
}

export const noteService = new NoteService();

