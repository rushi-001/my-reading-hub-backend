export default class ApiError extends Error {
    constructor(statusCode, message, errorType) {
        super(message);
        this.statusCode = statusCode;
        this.error = errorType;

        Error.captureStackTrace(this, this.constructor);
    }
}