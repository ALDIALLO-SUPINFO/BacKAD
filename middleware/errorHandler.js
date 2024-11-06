// src/middleware/errorHandler.js

const { logger } = require('./logger');

// Classe d'erreur personnalisée
class AppError extends Error {
    constructor(message, statusCode, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Types d'erreurs personnalisées
const ErrorTypes = {
    VALIDATION: 'VALIDATION_ERROR',
    AUTH: 'AUTHENTICATION_ERROR',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    DUPLICATE: 'DUPLICATE_ERROR',
    RATE_LIMIT: 'RATE_LIMIT_ERROR',
    API: 'API_ERROR',
    PINTEREST: 'PINTEREST_ERROR',
    GOOGLE: 'GOOGLE_AUTH_ERROR',
    DATABASE: 'DATABASE_ERROR'
};

// Gestionnaire d'erreurs principal
const errorHandler = (err, req, res, next) => {
    // Cloner l'erreur pour ne pas la modifier directement
    const error = {
        ...err,
        message: err.message,
        stack: err.stack
    };

    // Logger l'erreur
    logger.error('❌ Error caught:', {
        type: error.name,
        code: error.code,
        message: error.message,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userId: req.user?.id,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });

    // Gestion des différents types d'erreurs
    let errorResponse;

    switch (true) {
        // Erreurs de validation MongoDB
        case error.name === 'ValidationError':
            errorResponse = handleValidationError(error);
            break;

        // Erreurs de duplication MongoDB
        case error.code === 11000:
            errorResponse = handleDuplicateError(error);
            break;

        // Erreurs d'authentification JWT
        case ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name):
            errorResponse = handleJWTError(error);
            break;

        // Erreurs de l'API Pinterest
        case error.name === 'PinterestError':
            errorResponse = handlePinterestError(error);
            break;

        // Erreurs de l'API Google
        case error.name === 'GoogleAuthError':
            errorResponse = handleGoogleError(error);
            break;

        // Erreurs de cast MongoDB (IDs invalides)
        case error.name === 'CastError':
            errorResponse = handleCastError(error);
            break;

        // Erreurs de limite de taux
        case error.code === 'RATE_LIMIT_EXCEEDED':
            errorResponse = handleRateLimitError(error);
            break;

        // Erreurs personnalisées AppError
        case error instanceof AppError:
            errorResponse = handleAppError(error);
            break;

        // Erreurs par défaut
        default:
            errorResponse = handleDefaultError(error);
    }

    // Ajouter des informations supplémentaires en développement
    if (process.env.NODE_ENV === 'development') {
        errorResponse.debug = {
            stack: error.stack,
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        };
    }

    // Envoyer la réponse
    res.status(errorResponse.statusCode).json({
        success: false,
        ...errorResponse
    });

    // Enregistrer l'erreur dans la base de données si nécessaire
    if (errorResponse.statusCode >= 500) {
        logErrorToDatabase(error, req);
    }
};

// Gestionnaires d'erreurs spécifiques
const handleValidationError = (err) => ({
    statusCode: 400,
    code: ErrorTypes.VALIDATION,
    message: 'Erreur de validation des données',
    errors: Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message,
        value: error.value
    }))
});

const handleDuplicateError = (err) => ({
    statusCode: 409,
    code: ErrorTypes.DUPLICATE,
    message: 'Une entrée existe déjà avec cette valeur',
    field: Object.keys(err.keyPattern)[0],
    value: err.keyValue[Object.keys(err.keyPattern)[0]]
});

const handleJWTError = (err) => ({
    statusCode: 401,
    code: ErrorTypes.AUTH,
    message: err.name === 'TokenExpiredError' 
        ? 'Token expiré' 
        : 'Token invalide'
});

const handlePinterestError = (err) => ({
    statusCode: err.statusCode || 500,
    code: ErrorTypes.PINTEREST,
    message: 'Erreur Pinterest API',
    details: err.details || err.message
});

const handleGoogleError = (err) => ({
    statusCode: 401,
    code: ErrorTypes.GOOGLE,
    message: 'Erreur d\'authentification Google',
    details: err.message
});

const handleCastError = (err) => ({
    statusCode: 400,
    code: ErrorTypes.VALIDATION,
    message: 'Identifiant invalide',
    field: err.path,
    value: err.value
});

const handleRateLimitError = (err) => ({
    statusCode: 429,
    code: ErrorTypes.RATE_LIMIT,
    message: 'Trop de requêtes, veuillez réessayer plus tard',
    retryAfter: err.retryAfter
});

const handleAppError = (err) => ({
    statusCode: err.statusCode,
    code: err.code,
    message: err.message,
    details: err.details
});

const handleDefaultError = (err) => ({
    statusCode: 500,
    code: ErrorTypes.API,
    message: process.env.NODE_ENV === 'production'
        ? 'Une erreur inattendue s\'est produite'
        : err.message
});

// Fonction pour logger les erreurs dans la base de données
const logErrorToDatabase = async (error, req) => {
    try {
        if (!mongoose.connection.readyState === 1) return;

        await ErrorLog.create({
            type: error.name,
            code: error.code,
            message: error.message,
            stack: error.stack,
            request: {
                method: req.method,
                url: req.originalUrl,
                body: req.body,
                params: req.params,
                query: req.query,
                ip: req.ip,
                userAgent: req.get('user-agent')
            },
            user: req.user?._id,
            timestamp: new Date()
        });
    } catch (err) {
        logger.error('Failed to log error to database:', err);
    }
};

module.exports = {
    AppError,
    ErrorTypes,
    errorHandler
};