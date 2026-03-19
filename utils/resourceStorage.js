import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import ApiError from "./apiError.js";
import { buildPublicFileUrl, UPLOADS_ROOT } from "./fileStorage.js";
import { toStoredResourcePath } from "./url.utils.js";

const LOCAL_STORAGE_PROVIDER = "local";
const FIREBASE_STORAGE_PROVIDER = "firebase";
const FIREBASE_URL_HOSTNAME = "firebasestorage.googleapis.com";

const configuredStorageProvider = (
  process.env.FILE_STORAGE_PROVIDER ||
  process.env.STORAGE_PROVIDER ||
  ""
)
  .trim()
  .toLowerCase();

export const STORAGE_PROVIDER =
  configuredStorageProvider ||
  (process.env.FIREBASE_STORAGE_BUCKET
    ? FIREBASE_STORAGE_PROVIDER
    : LOCAL_STORAGE_PROVIDER);

export const isFirebaseStorageEnabled =
  STORAGE_PROVIDER === FIREBASE_STORAGE_PROVIDER;

let firebaseAppInstance = null;

const toNullableTrimmedText = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const getFirebaseBucketName = () =>
  toNullableTrimmedText(process.env.FIREBASE_STORAGE_BUCKET);

const normalizeFirebaseServiceAccount = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const projectId = toNullableTrimmedText(value.projectId || value.project_id);
  const clientEmail = toNullableTrimmedText(
    value.clientEmail || value.client_email
  );
  const privateKey = toNullableTrimmedText(
    value.privateKey || value.private_key
  );

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
};

const parseJsonValue = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const resolveFirebaseServiceAccount = () => {
  const jsonValue = toNullableTrimmedText(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (jsonValue) {
    return normalizeFirebaseServiceAccount(parseJsonValue(jsonValue));
  }

  const base64Value = toNullableTrimmedText(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  );
  if (base64Value) {
    const decoded = Buffer.from(base64Value, "base64").toString("utf8");
    return normalizeFirebaseServiceAccount(parseJsonValue(decoded));
  }

  return normalizeFirebaseServiceAccount({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  });
};

const getFirebaseApp = () => {
  if (!isFirebaseStorageEnabled) {
    return null;
  }

  if (firebaseAppInstance) {
    return firebaseAppInstance;
  }

  const bucketName = getFirebaseBucketName();
  if (!bucketName) {
    throw new ApiError(
      500,
      "Firebase Storage is enabled but FIREBASE_STORAGE_BUCKET is missing.",
      "StorageConfigError"
    );
  }

  const serviceAccount = resolveFirebaseServiceAccount();
  if (!serviceAccount) {
    throw new ApiError(
      500,
      "Firebase Storage is enabled but service account credentials are missing.",
      "StorageConfigError"
    );
  }

  firebaseAppInstance =
    getApps()[0] ||
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });

  return firebaseAppInstance;
};

const getFirebaseBucket = () => {
  const app = getFirebaseApp();
  const bucketName = getFirebaseBucketName();

  return getStorage(app).bucket(bucketName);
};

const removeLocalFile = async (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error(`Failed to delete local file: ${filePath}`, error);
    }
  }
};

const toUploadRelativePathFromResourceUrl = (resourceUrl) => {
  const storedPath = toStoredResourcePath(resourceUrl);
  if (typeof storedPath !== "string") {
    return null;
  }

  const trimmed = storedPath.trim();
  if (!trimmed.startsWith("/uploads/")) {
    return null;
  }

  const relativePath = trimmed
    .slice("/uploads/".length)
    .split("?")[0]
    .split("#")[0];

  return relativePath || null;
};

const resolveUploadAbsolutePath = (resourceUrl) => {
  const uploadRelativePath = toUploadRelativePathFromResourceUrl(resourceUrl);
  if (!uploadRelativePath) {
    return null;
  }

  const rootPath = path.resolve(UPLOADS_ROOT);
  const absolutePath = path.resolve(rootPath, uploadRelativePath);
  const relativeToRoot = path.relative(rootPath, absolutePath);

  if (
    !relativeToRoot ||
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot)
  ) {
    return null;
  }

  return absolutePath;
};

const toFirebaseDownloadUrl = (bucketName, storagePath, downloadToken) =>
  `https://${FIREBASE_URL_HOSTNAME}/v0/b/${bucketName}/o/${encodeURIComponent(
    storagePath
  )}?alt=media&token=${encodeURIComponent(downloadToken)}`;

const resolveFirebaseStoragePathFromUrl = (resourceUrl) => {
  const trimmedUrl = toNullableTrimmedText(resourceUrl);
  if (!trimmedUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    const bucketName = getFirebaseBucketName();

    if (!bucketName) {
      return null;
    }

    if (parsedUrl.hostname === FIREBASE_URL_HOSTNAME) {
      const prefix = `/v0/b/${bucketName}/o/`;
      if (parsedUrl.pathname.startsWith(prefix)) {
        return decodeURIComponent(parsedUrl.pathname.slice(prefix.length));
      }
    }

    if (parsedUrl.hostname === "storage.googleapis.com") {
      const prefix = `/${bucketName}/`;
      if (parsedUrl.pathname.startsWith(prefix)) {
        return decodeURIComponent(parsedUrl.pathname.slice(prefix.length));
      }
    }

    return null;
  } catch {
    return null;
  }
};

const deleteFirebaseFile = async (storagePath) => {
  const bucket = getFirebaseBucket();

  try {
    await bucket.file(storagePath).delete({ ignoreNotFound: true });
  } catch (error) {
    console.error(`Failed to delete Firebase file: ${storagePath}`, error);
  }
};

const buildStorageFileName = (file) => {
  const extension = path.extname(file?.originalname || "").toLowerCase();
  const fileName =
    typeof file?.filename === "string" && file.filename.trim().length
      ? file.filename.trim()
      : `${Date.now()}-${randomUUID()}${extension}`;

  return fileName;
};

export const storeUploadedFile = async (file) => {
  if (!file || typeof file !== "object") {
    throw new ApiError(400, "Uploaded file is required.", "BadRequest");
  }

  const category =
    typeof file.storageCategory === "string" && file.storageCategory.trim().length
      ? file.storageCategory.trim()
      : "book-file";
  const storedFileName = buildStorageFileName(file);

  if (!isFirebaseStorageEnabled) {
    return {
      url: buildPublicFileUrl(`${category}/${storedFileName}`),
      storagePath: null,
    };
  }

  if (!file.path) {
    throw new ApiError(
      500,
      "Temporary upload path is missing for Firebase Storage upload.",
      "StorageUploadFailed"
    );
  }

  const bucket = getFirebaseBucket();
  const storagePath = `uploads/${category}/${storedFileName}`;
  const downloadToken = randomUUID();

  try {
    await bucket.upload(file.path, {
      destination: storagePath,
      metadata: {
        contentType: file.mimetype || "application/octet-stream",
        cacheControl: "public,max-age=31536000",
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          originalName: file.originalname || storedFileName,
        },
      },
    });

    return {
      url: toFirebaseDownloadUrl(bucket.name, storagePath, downloadToken),
      storagePath,
    };
  } catch (error) {
    console.error("Failed to upload file to Firebase Storage", error);
    throw new ApiError(
      500,
      "Failed to upload file to Firebase Storage.",
      "StorageUploadFailed"
    );
  } finally {
    await removeLocalFile(file.path);
  }
};

const normalizeResourceDescriptor = (resource) => {
  if (!resource || typeof resource !== "object") {
    return null;
  }

  const url = toNullableTrimmedText(resource.url);
  const storagePath = toNullableTrimmedText(resource.storagePath);

  if (!url && !storagePath) {
    return null;
  }

  return { url, storagePath };
};

const getResourceDeletionKey = (resource) =>
  resource?.storagePath || resource?.url || null;

export const deleteStoredResources = async (resources = []) => {
  const uniqueResources = Array.from(
    new Map(
      resources
        .map(normalizeResourceDescriptor)
        .filter(Boolean)
        .map((resource) => [getResourceDeletionKey(resource), resource])
        .filter(([key]) => Boolean(key))
    ).values()
  );

  await Promise.all(
    uniqueResources.map(async (resource) => {
      const firebaseStoragePath =
        resource.storagePath || resolveFirebaseStoragePathFromUrl(resource.url);

      if (firebaseStoragePath && isFirebaseStorageEnabled) {
        await deleteFirebaseFile(firebaseStoragePath);
        return;
      }

      const localUploadPath = resolveUploadAbsolutePath(resource.url);
      if (localUploadPath) {
        await removeLocalFile(localUploadPath);
      }
    })
  );
};
