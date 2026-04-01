import axios from "axios";
import fs from "fs/promises";
import path from "path";
import ApiError from "../utils/apiError.js";
import { BookModel } from "../models/book.model.js";
import { NoteModel } from "../models/note.model.js";
import { SettingsModel } from "../models/settings.model.js";
import { isPlainObject } from "../utils/object.utils.js";
import { ensureUploadsDirectory, UPLOADS_ROOT } from "../utils/fileStorage.js";

const DEFAULT_GITHUB_DATA_REPO_OWNER = "rushi-001";
const DEFAULT_GITHUB_DATA_REPO_NAME = "my_book_hub_data";
const SNAPSHOT_FORMAT_VERSION = 1;
const SNAPSHOT_ROOT_PATH = "backup/latest";
const SNAPSHOT_DATA_ROOT_PATH = `${SNAPSHOT_ROOT_PATH}/data`;
const SNAPSHOT_UPLOADS_ROOT_PATH = `${SNAPSHOT_ROOT_PATH}/uploads`;
const SNAPSHOT_METADATA_PATH = `${SNAPSHOT_ROOT_PATH}/metadata.json`;
const SNAPSHOT_BOOKS_PATH = `${SNAPSHOT_DATA_ROOT_PATH}/books.json`;
const SNAPSHOT_NOTES_PATH = `${SNAPSHOT_DATA_ROOT_PATH}/notes.json`;
const SNAPSHOT_SETTINGS_PATH = `${SNAPSHOT_DATA_ROOT_PATH}/settings.json`;
const DEFAULT_SYNC_COMMITS_LIMIT = 20;
const MAX_SYNC_COMMITS_LIMIT = 100;
const MAX_GITHUB_SYNC_FILE_BYTES = 95 * 1024 * 1024;

const toPosixPath = (value) => value.replace(/\\/g, "/");

const isSnapshotRepoPath = (repoPath) =>
  repoPath === SNAPSHOT_ROOT_PATH || repoPath.startsWith(`${SNAPSHOT_ROOT_PATH}/`);

const createGithubApiClient = (token) =>
  axios.create({
    baseURL: "https://api.github.com",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "my-reading-hub-backend",
    },
  });

const toGithubApiError = (error, fallbackMessage) => {
  if (error instanceof ApiError) {
    return error;
  }

  const status = error?.response?.status;
  const apiMessage =
    error?.response?.data?.message ||
    error?.message ||
    "Unexpected GitHub API error";
  const message = `${fallbackMessage}: ${apiMessage}`;

  if (status === 404) {
    return new ApiError(404, message, "NotFound");
  }

  return new ApiError(
    status && status >= 400 && status < 500 ? status : 502,
    message,
    "GitHubSyncError"
  );
};

const runGithubRequest = async (operation, fallbackMessage) => {
  try {
    return await operation();
  } catch (error) {
    throw toGithubApiError(error, fallbackMessage);
  }
};

const toCommitUrl = (owner, repoName, sha) =>
  `https://github.com/${owner}/${repoName}/commit/${sha}`;

const mapRestCommit = (context, commit) => ({
  sha: commit.sha,
  message: commit.commit?.message || "",
  date: commit.commit?.author?.date || commit.commit?.committer?.date || null,
  author:
    commit.commit?.author?.name ||
    commit.author?.login ||
    commit.commit?.committer?.name ||
    null,
  url: commit.html_url || toCommitUrl(context.owner, context.repoName, commit.sha),
});

const mapGitCommit = (context, commit) => ({
  sha: commit.sha,
  message: commit.message || "",
  date: commit.author?.date || commit.committer?.date || null,
  author: commit.author?.name || commit.committer?.name || null,
  url: toCommitUrl(context.owner, context.repoName, commit.sha),
});

const createJsonFileContent = (value) => `${JSON.stringify(value, null, 2)}\n`;

const decodeGithubBlob = (blob) => {
  const content = typeof blob?.content === "string" ? blob.content : "";
  const sanitizedContent = content.replace(/\n/g, "");
  const encoding = typeof blob?.encoding === "string" ? blob.encoding : "base64";

  if (encoding === "base64") {
    return Buffer.from(sanitizedContent, "base64");
  }

  return Buffer.from(content, "utf8");
};

const normalizeRelativeUploadPath = (relativePath) =>
  toPosixPath(relativePath).replace(/^\/+/, "");

const resolveSafeChildPath = (rootPath, relativePath) => {
  const normalizedRelativePath = normalizeRelativeUploadPath(relativePath);
  const resolvedRootPath = path.resolve(rootPath);
  const resolvedTargetPath = path.resolve(resolvedRootPath, normalizedRelativePath);
  const relativeToRoot = path.relative(resolvedRootPath, resolvedTargetPath);

  if (
    !normalizedRelativePath ||
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot)
  ) {
    throw new ApiError(400, "Invalid upload path in sync payload", "BadRequest");
  }

  return resolvedTargetPath;
};

const buildSnapshotMetadata = ({
  books,
  notes,
  settings,
  uploadFiles,
  triggeredBy,
}) => ({
  version: SNAPSHOT_FORMAT_VERSION,
  generatedAt: new Date().toISOString(),
  triggeredBy,
  summary: {
    booksCount: books.length,
    notesCount: notes.length,
    hasSettings: Boolean(settings),
    uploadFilesCount: uploadFiles.length,
    totalUploadBytes: uploadFiles.reduce(
      (totalBytes, file) => totalBytes + Number(file.size || 0),
      0
    ),
  },
});

const buildDefaultCommitMessage = (metadata, triggeredBy) =>
  `Sync reading hub snapshot by ${triggeredBy} on ${metadata.generatedAt}`;

const buildCommitMessage = (message, metadata, triggeredBy) => {
  const trimmedMessage = typeof message === "string" ? message.trim() : "";
  return trimmedMessage || buildDefaultCommitMessage(metadata, triggeredBy);
};

const normalizeCommitLimit = (value) => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number.parseInt(value, 10)
      : Number.NaN;

  if (Number.isNaN(numericValue)) {
    return DEFAULT_SYNC_COMMITS_LIMIT;
  }

  if (numericValue < 1) return 1;
  if (numericValue > MAX_SYNC_COMMITS_LIMIT) return MAX_SYNC_COMMITS_LIMIT;
  return numericValue;
};

const getConfiguredGithubBranch = () =>
  process.env.MY_BOOK_HUB_DATA_BRANCH?.trim() ||
  process.env.GITHUB_DATA_REPO_BRANCH?.trim() ||
  "";

const listLocalUploadFiles = async (currentDirectory = UPLOADS_ROOT) => {
  ensureUploadsDirectory();

  const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listLocalUploadFiles(absolutePath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stats = await fs.stat(absolutePath);
    const relativePath = normalizeRelativeUploadPath(
      path.relative(UPLOADS_ROOT, absolutePath)
    );

    if (stats.size > MAX_GITHUB_SYNC_FILE_BYTES) {
      throw new ApiError(
        413,
        `Upload file ${relativePath} is too large for GitHub sync`,
        "PayloadTooLarge"
      );
    }

    files.push({
      absolutePath,
      relativePath,
      size: stats.size,
    });
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
};

const stageUploadFiles = async (uploadFiles) => {
  const parentDirectory = path.dirname(UPLOADS_ROOT);
  const stagingDirectory = path.join(
    parentDirectory,
    `uploads-sync-stage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  await fs.mkdir(stagingDirectory, { recursive: true });

  for (const file of uploadFiles) {
    const targetPath = resolveSafeChildPath(stagingDirectory, file.relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, file.buffer);
  }

  return stagingDirectory;
};

const swapUploadsDirectory = async (stagingDirectory) => {
  const backupDirectory = `${UPLOADS_ROOT}__backup_${Date.now()}`;
  let backupCreated = false;

  try {
    await fs.mkdir(path.dirname(UPLOADS_ROOT), { recursive: true });

    try {
      await fs.rename(UPLOADS_ROOT, backupDirectory);
      backupCreated = true;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }

    await fs.rename(stagingDirectory, UPLOADS_ROOT);

    if (backupCreated) {
      await fs.rm(backupDirectory, { recursive: true, force: true });
    }
  } catch (error) {
    try {
      await fs.rm(UPLOADS_ROOT, { recursive: true, force: true });
    } catch {}

    if (backupCreated) {
      try {
        await fs.rename(backupDirectory, UPLOADS_ROOT);
      } catch {}
    }

    try {
      await fs.rm(stagingDirectory, { recursive: true, force: true });
    } catch {}

    throw error;
  }
};

const replaceLocalSnapshotData = async ({ books, notes, settings }) => {
  await Promise.all([
    BookModel.deleteMany({}),
    NoteModel.deleteMany({}),
    SettingsModel.deleteMany({}),
  ]);

  if (books.length) {
    await BookModel.insertMany(books, { ordered: true });
  }

  if (notes.length) {
    await NoteModel.insertMany(notes, { ordered: true });
  }

  if (isPlainObject(settings)) {
    await SettingsModel.create(settings);
  }
};

class GithubSyncService {
  async resolveGithubContext() {
    const token = process.env.MY_BOOK_HUB_DATA_REPO_TOKEN?.trim();
    if (!token) {
      throw new ApiError(
        500,
        "MY_BOOK_HUB_DATA_REPO_TOKEN is not configured",
        "ServerMisconfigured"
      );
    }

    const owner =
      process.env.GITHUB_DATA_REPO_OWNER?.trim() || DEFAULT_GITHUB_DATA_REPO_OWNER;
    const repoName =
      process.env.GITHUB_DATA_REPO_NAME?.trim() || DEFAULT_GITHUB_DATA_REPO_NAME;
    const client = createGithubApiClient(token);

    const repoInfo = await runGithubRequest(
      () => client.get(`/repos/${owner}/${repoName}`),
      "Failed to load GitHub data repository"
    );

    const branch = getConfiguredGithubBranch() || repoInfo.data.default_branch;

    if (!branch) {
      throw new ApiError(
        500,
        "Unable to resolve GitHub data repository branch",
        "ServerMisconfigured"
      );
    }

    return {
      client,
      owner,
      repoName,
      branch,
    };
  }

  async getBranchRef(context) {
    try {
      const response = await context.client.get(
        `/repos/${context.owner}/${context.repoName}/git/ref/heads/${encodeURIComponent(
          context.branch
        )}`
      );

      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        return null;
      }

      throw toGithubApiError(error, "Failed to load GitHub branch reference");
    }
  }

  async getGitCommit(context, sha) {
    const response = await runGithubRequest(
      () =>
        context.client.get(
          `/repos/${context.owner}/${context.repoName}/git/commits/${sha}`
        ),
      "Failed to load GitHub commit"
    );

    return response.data;
  }

  async getGitTree(context, treeSha) {
    const response = await runGithubRequest(
      () =>
        context.client.get(
          `/repos/${context.owner}/${context.repoName}/git/trees/${treeSha}`,
          {
            params: { recursive: 1 },
          }
        ),
      "Failed to load GitHub repository tree"
    );

    if (response.data?.truncated) {
      throw new ApiError(
        500,
        "GitHub repository tree is too large to sync safely",
        "GitHubSyncError"
      );
    }

    return response.data;
  }

  async createBlob(context, content, encoding) {
    const response = await runGithubRequest(
      () =>
        context.client.post(
          `/repos/${context.owner}/${context.repoName}/git/blobs`,
          {
            content,
            encoding,
          }
        ),
      "Failed to create GitHub blob"
    );

    return response.data;
  }

  async createTree(context, { baseTreeSha, tree }) {
    const payload = { tree };
    if (baseTreeSha) {
      payload.base_tree = baseTreeSha;
    }

    const response = await runGithubRequest(
      () =>
        context.client.post(
          `/repos/${context.owner}/${context.repoName}/git/trees`,
          payload
        ),
      "Failed to create GitHub tree"
    );

    return response.data;
  }

  async createCommit(context, { message, treeSha, parentSha }) {
    const payload = {
      message,
      tree: treeSha,
      parents: parentSha ? [parentSha] : [],
    };

    const response = await runGithubRequest(
      () =>
        context.client.post(
          `/repos/${context.owner}/${context.repoName}/git/commits`,
          payload
        ),
      "Failed to create GitHub commit"
    );

    return response.data;
  }

  async updateBranchRef(context, commitSha, branchExists) {
    if (branchExists) {
      await runGithubRequest(
        () =>
          context.client.patch(
            `/repos/${context.owner}/${context.repoName}/git/refs/heads/${encodeURIComponent(
              context.branch
            )}`,
            {
              sha: commitSha,
              force: false,
            }
          ),
        "Failed to update GitHub branch reference"
      );

      return;
    }

    await runGithubRequest(
      () =>
        context.client.post(`/repos/${context.owner}/${context.repoName}/git/refs`, {
          ref: `refs/heads/${context.branch}`,
          sha: commitSha,
        }),
      "Failed to create GitHub branch reference"
    );
  }

  async getBlob(context, sha) {
    const response = await runGithubRequest(
      () =>
        context.client.get(
          `/repos/${context.owner}/${context.repoName}/git/blobs/${sha}`
        ),
      "Failed to download GitHub blob"
    );

    return response.data;
  }

  async getSyncCommitHistory(context, limit = DEFAULT_SYNC_COMMITS_LIMIT) {
    const response = await runGithubRequest(
      () =>
        context.client.get(`/repos/${context.owner}/${context.repoName}/commits`, {
          params: {
            sha: context.branch,
            path: SNAPSHOT_ROOT_PATH,
            per_page: normalizeCommitLimit(limit),
          },
        }),
      "Failed to fetch GitHub sync commits"
    );

    return Array.isArray(response.data) ? response.data : [];
  }

  async collectLocalSnapshot(triggeredBy) {
    ensureUploadsDirectory();

    const [bookDocuments, noteDocuments, settingsDocument, uploadFiles] =
      await Promise.all([
        BookModel.find({}).sort({ updatedAt: -1, createdAt: -1 }),
        NoteModel.find({}).sort({ updatedAt: -1, createdAt: -1 }),
        SettingsModel.findOne({}),
        listLocalUploadFiles(),
      ]);

    const books = bookDocuments.map((book) => book.toJSON());
    const notes = noteDocuments.map((note) => note.toJSON());
    const settings = settingsDocument ? settingsDocument.toJSON() : null;
    const metadata = buildSnapshotMetadata({
      books,
      notes,
      settings,
      uploadFiles,
      triggeredBy,
    });

    return {
      metadata,
      books,
      notes,
      settings,
      uploadFiles,
    };
  }

  async pushSnapshot({ message, triggeredBy = "admin" } = {}) {
    const context = await this.resolveGithubContext();
    const branchRef = await this.getBranchRef(context);
    const snapshot = await this.collectLocalSnapshot(triggeredBy);

    let baseTreeSha = null;
    let parentCommitSha = null;
    let existingSnapshotPaths = [];

    if (branchRef?.object?.sha) {
      parentCommitSha = branchRef.object.sha;
      const parentCommit = await this.getGitCommit(context, parentCommitSha);
      baseTreeSha = parentCommit.tree?.sha || null;

      if (baseTreeSha) {
        const currentTree = await this.getGitTree(context, baseTreeSha);
        existingSnapshotPaths = (currentTree.tree || [])
          .filter((entry) => entry?.type === "blob" && isSnapshotRepoPath(entry.path))
          .map((entry) => entry.path);
      }
    }

    const nextSnapshotPaths = new Set();
    const treeEntries = [];

    const addJsonTreeEntry = async (repoPath, value) => {
      nextSnapshotPaths.add(repoPath);
      const blob = await this.createBlob(
        context,
        createJsonFileContent(value),
        "utf-8"
      );

      treeEntries.push({
        path: repoPath,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    };

    await addJsonTreeEntry(SNAPSHOT_METADATA_PATH, snapshot.metadata);
    await addJsonTreeEntry(SNAPSHOT_BOOKS_PATH, snapshot.books);
    await addJsonTreeEntry(SNAPSHOT_NOTES_PATH, snapshot.notes);
    await addJsonTreeEntry(SNAPSHOT_SETTINGS_PATH, snapshot.settings);

    for (const file of snapshot.uploadFiles) {
      const repoPath = `${SNAPSHOT_UPLOADS_ROOT_PATH}/${file.relativePath}`;
      nextSnapshotPaths.add(repoPath);

      const contentBuffer = await fs.readFile(file.absolutePath);
      const blob = await this.createBlob(
        context,
        contentBuffer.toString("base64"),
        "base64"
      );

      treeEntries.push({
        path: repoPath,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }

    for (const existingPath of existingSnapshotPaths) {
      if (!nextSnapshotPaths.has(existingPath)) {
        treeEntries.push({
          path: existingPath,
          mode: "100644",
          type: "blob",
          sha: null,
        });
      }
    }

    const commitMessage = buildCommitMessage(message, snapshot.metadata, triggeredBy);
    const tree = await this.createTree(context, { baseTreeSha, tree: treeEntries });
    const commit = await this.createCommit(context, {
      message: commitMessage,
      treeSha: tree.sha,
      parentSha: parentCommitSha,
    });

    await this.updateBranchRef(context, commit.sha, Boolean(branchRef));

    return {
      repository: {
        owner: context.owner,
        name: context.repoName,
        branch: context.branch,
      },
      snapshot: snapshot.metadata,
      commit: mapGitCommit(context, commit),
    };
  }

  async readJsonSnapshotFile(context, treeEntriesByPath, snapshotPath, fallbackValue) {
    const treeEntry = treeEntriesByPath.get(snapshotPath);
    if (!treeEntry) {
      return fallbackValue;
    }

    const blob = await this.getBlob(context, treeEntry.sha);
    const buffer = decodeGithubBlob(blob);
    return JSON.parse(buffer.toString("utf8"));
  }

  async pullSnapshot() {
    const context = await this.resolveGithubContext();
    const commitHistory = await this.getSyncCommitHistory(context, 1);
    const latestCommit = commitHistory[0];

    if (!latestCommit) {
      throw new ApiError(
        404,
        "No synced snapshot found in the GitHub data repository",
        "NotFound"
      );
    }

    const gitCommit = await this.getGitCommit(context, latestCommit.sha);
    const gitTree = await this.getGitTree(context, gitCommit.tree.sha);
    const snapshotTreeEntries = (gitTree.tree || []).filter(
      (entry) => entry?.type === "blob" && isSnapshotRepoPath(entry.path)
    );
    const treeEntriesByPath = new Map(
      snapshotTreeEntries.map((entry) => [entry.path, entry])
    );

    const metadata = await this.readJsonSnapshotFile(
      context,
      treeEntriesByPath,
      SNAPSHOT_METADATA_PATH,
      null
    );

    if (!metadata) {
      throw new ApiError(
        404,
        "Latest GitHub snapshot is missing metadata.json",
        "NotFound"
      );
    }

    const [books, notes, settings] = await Promise.all([
      this.readJsonSnapshotFile(context, treeEntriesByPath, SNAPSHOT_BOOKS_PATH, []),
      this.readJsonSnapshotFile(context, treeEntriesByPath, SNAPSHOT_NOTES_PATH, []),
      this.readJsonSnapshotFile(
        context,
        treeEntriesByPath,
        SNAPSHOT_SETTINGS_PATH,
        null
      ),
    ]);
    const normalizedBooks = Array.isArray(books) ? books : [];
    const normalizedNotes = Array.isArray(notes) ? notes : [];
    const normalizedSettings = isPlainObject(settings) ? settings : null;

    const uploadTreeEntries = snapshotTreeEntries.filter((entry) =>
      entry.path.startsWith(`${SNAPSHOT_UPLOADS_ROOT_PATH}/`)
    );

    const uploadFiles = [];
    for (const entry of uploadTreeEntries) {
      const blob = await this.getBlob(context, entry.sha);
      uploadFiles.push({
        relativePath: entry.path.slice(`${SNAPSHOT_UPLOADS_ROOT_PATH}/`.length),
        buffer: decodeGithubBlob(blob),
      });
    }

    const stagingDirectory = await stageUploadFiles(uploadFiles);

    try {
      await replaceLocalSnapshotData({
        books: normalizedBooks,
        notes: normalizedNotes,
        settings: normalizedSettings,
      });
      await swapUploadsDirectory(stagingDirectory);
    } catch (error) {
      try {
        await fs.rm(stagingDirectory, { recursive: true, force: true });
      } catch {}

      throw error;
    }

    return {
      repository: {
        owner: context.owner,
        name: context.repoName,
        branch: context.branch,
      },
      snapshot: metadata,
      commit: mapRestCommit(context, latestCommit),
      applied: {
        booksCount: normalizedBooks.length,
        notesCount: normalizedNotes.length,
        hasSettings: Boolean(normalizedSettings),
        uploadFilesCount: uploadFiles.length,
      },
    };
  }

  async fetchSyncCommits({ limit = DEFAULT_SYNC_COMMITS_LIMIT } = {}) {
    const context = await this.resolveGithubContext();
    const commits = await this.getSyncCommitHistory(context, limit);

    return commits.map((commit) => mapRestCommit(context, commit));
  }
}

export const githubSyncService = new GithubSyncService();
