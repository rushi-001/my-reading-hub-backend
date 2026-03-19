import fs from "fs";
import path from "path";

export const UPLOADS_ROOT = path.resolve(process.cwd(), "storage", "uploads");

const toPosixPath = (value) => value.replace(/\\/g, "/");

export const ensureUploadsDirectory = () => {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
};

export const buildPublicFileUrl = (relativePath) =>
  `/uploads/${toPosixPath(relativePath)}`;
