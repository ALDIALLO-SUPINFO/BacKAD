// src/utils/errors.js

class PinterestError extends Error {
    constructor(code, message, statusCode = 500, details = null) {
        super(message);
        this.name = 'PinterestError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}

module.exports = { PinterestError };