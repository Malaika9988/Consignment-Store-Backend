const errorHandler = (err, req, res, next) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
    console.error(err.stack); // Log the stack trace for debugging

    // Check if headers have already been sent to prevent errors
    if (res.headersSent) {
        return next(err); // Pass the error to Express's default error handler
    }

    const statusCode = err.statusCode || 500; // Default to 500 if no specific status code
    const message = err.message || 'An unexpected error occurred on the server.';

    // For production, you might want to hide internal error details
    const response = process.env.NODE_ENV === 'production' && statusCode === 500
        ? { message: 'Internal Server Error' }
        : { message: message, error: err.stack }; // Include stack in development

    res.status(statusCode).json(response);
};

module.exports = errorHandler;