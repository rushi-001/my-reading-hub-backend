import validator from "validator";
import ApiError from "./apiError.js";

export class MongoIdCheck {
    static ensureMongoId = (id) => {
        const isMongoId = validator.isMongoId(id);

        if (!isMongoId) {
            throw new ApiError(400, "Invalid Id format", "BadRequest");
        }

        return true;
    }
}
