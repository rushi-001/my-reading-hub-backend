import fs from "fs";
import path from "path";

const isServerlessRuntime = Boolean(
  process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
);

const defaultUploadsRoot = isServerlessRuntime
  ? path.resolve("/tmp", "uploads")
  : path.resolve(process.cwd(), "storage", "uploads");

export const UPLOADS_ROOT = process.env.UPLOADS_ROOT
  ? path.resolve(process.env.UPLOADS_ROOT)
  : defaultUploadsRoot;

const toPosixPath = (value) => value.replace(/\\/g, "/");

export const ensureUploadsDirectory = () => {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
};

export const buildPublicFileUrl = (relativePath) =>
  `/uploads/${toPosixPath(relativePath)}`;
