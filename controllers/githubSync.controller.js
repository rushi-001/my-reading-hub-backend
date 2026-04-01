import { githubSyncService } from "../services/githubSync.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const clampLimit = (value, fallback = 20) => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number.parseInt(value, 10)
      : Number.NaN;

  if (Number.isNaN(numericValue)) {
    return fallback;
  }

  if (numericValue < 1) return 1;
  if (numericValue > 100) return 100;
  return numericValue;
};

class GithubSyncController {
  pushSnapshot = asyncHandler(async (req, res) => {
    const result = await githubSyncService.pushSnapshot({
      message: req.body?.message,
      triggeredBy: req.admin?.username || "admin",
    });

    res.status(200).json(result);
  });

  pullSnapshot = asyncHandler(async (_req, res) => {
    const result = await githubSyncService.pullSnapshot();
    res.status(200).json(result);
  });

  fetchCommits = asyncHandler(async (req, res) => {
    const commits = await githubSyncService.fetchSyncCommits({
      limit: clampLimit(req.query.limit, 20),
    });

    res.status(200).json({ commits });
  });
}

export const githubSyncController = new GithubSyncController();
