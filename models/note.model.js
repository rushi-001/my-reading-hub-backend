import mongoose from "mongoose";
import { randomUUID } from "crypto";

const noteSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => randomUUID(),
    },
    bookId: { type: String, required: true, trim: true },
    title: { type: String, default: "", trim: true },
    content: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

noteSchema.set("toJSON", {
  transform: (_, result) => {
    delete result._id;
    return result;
  },
});

export const NoteModel = mongoose.model("Note", noteSchema);

