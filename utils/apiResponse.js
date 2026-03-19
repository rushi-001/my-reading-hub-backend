export default class ApiResponse {

    static success = (res, statusCode, data, message) => {
        res.status(statusCode).json({
            success: true,
            data,
            message,
        });
    }

    static error = (res, statusCode, errorMessage, error) => {
        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: error
        });
    }
}

