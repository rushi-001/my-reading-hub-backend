import ApiError from "../utils/apiError.js";
import { isPlainObject } from "../utils/object.utils.js";

export const requireObjectBody = (req, _res, next) => {
  if (!isPlainObject(req.body)) {
    return next(
      new ApiError(400, "Request body must be a JSON object", "BadRequest")
    );
  }

  return next();
};

