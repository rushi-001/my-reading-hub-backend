import { noteService } from "../services/note.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

class NoteController {
  fetchNotes = asyncHandler(async (_req, res) => {
    const notes = await noteService.fetchNotes();
    res.status(200).json({ notes });
  });

  createNote = asyncHandler(async (req, res) => {
    const note = await noteService.createNote(req.body);
    res.status(201).json({ note });
  });

  updateNote = asyncHandler(async (req, res) => {
    const note = await noteService.updateNote(req.params.id, req.body);
    res.status(200).json({ note });
  });

  deleteNote = asyncHandler(async (req, res) => {
    const deletedId = await noteService.deleteNote(req.params.id);
    res.status(200).json({ success: true, deletedId });
  });
}

export const noteController = new NoteController();

