const errorHandler = (err, req, res, next) => {
    console.error('❌ Erreur:', {
        method: req.method,
        url: req.url,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    // Gestion des erreurs de validation MongoDB
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Erreur de validation',
            errors: Object.values(err.errors).map(error => error.message)
        });
    }

    // Gestion des erreurs de duplication MongoDB
    if (err.code === 11000) {
        return res.status(400).json({
            success: false,
            message: 'Cette valeur existe déjà',
            field: Object.keys(err.keyPattern)[0]
        });
    }

    // Gestion des erreurs JWT
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Token invalide'
        });
    }

    // Gestion des erreurs de token expiré
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expiré'
        });
    }

    // Message d'erreur par défaut
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'development' 
            ? err.message 
            : 'Une erreur est survenue',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;