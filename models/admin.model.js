import mongoose from "mongoose";
import { randomUUID } from "crypto";

const adminSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => randomUUID(),
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: { type: String, default: "Admin", trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      default: "admin",
      enum: ["admin"],
    },
    tokenVersion: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

adminSchema.set("toJSON", {
  transform: (_, result) => {
    delete result._id;
    delete result.passwordHash;
    delete result.tokenVersion;
    return result;
  },
});

export const AdminModel = mongoose.model("Admin", adminSchema);
