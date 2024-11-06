// src/middleware/rateLimiter.js

const rateLimit = require('express-rate-limit');
const { PinterestError } = require('../src//utils/errors');

/**
 * Crée un middleware de limitation de taux
 * @param {string} name - Nom de l'endpoint
 * @param {number} max - Nombre maximum de requêtes
 * @param {number} windowMinutes - Fenêtre de temps en minutes
 */
const rateLimiter = (name, max, windowMinutes) => {
    return rateLimit({
        windowMs: windowMinutes * 60 * 1000, // Conversion en millisecondes
        max, // Limite de requêtes par fenêtre
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Trop de requêtes, veuillez réessayer plus tard'
            }
        },
        keyGenerator: (req) => {
            // Utiliser l'ID utilisateur comme clé si disponible
            return req.user?.id || req.ip;
        },
        handler: (req, res) => {
            throw new PinterestError(
                'RATE_LIMIT_EXCEEDED',
                'Trop de requêtes, veuillez réessayer plus tard',
                429,
                {
                    retryAfter: Math.ceil(windowMinutes * 60),
                    endpoint: name
                }
            );
        },
        headers: true, // Ajouter les headers X-RateLimit
        skipFailedRequests: false, // Compter aussi les requêtes échouées
        skipSuccessfulRequests: false, // Compter aussi les requêtes réussies
        standardHeaders: true, // Retourner les headers 'RateLimit-*'
        legacyHeaders: false, // Désactiver les anciens headers 'X-RateLimit-*'
    });
};

// Limiteur pour les routes d'authentification
const authLimiter = rateLimiter('auth', 5, 15); // 5 tentatives par 15 minutes

// Limiteur pour les routes API
const apiLimiter = rateLimiter('api', 100, 15); // 100 requêtes par 15 minutes

// Limiteur pour les routes sensibles
const sensitiveLimiter = rateLimiter('sensitive', 3, 60); // 3 tentatives par heure

// Export des limiteurs
module.exports = {
    rateLimiter,
    authLimiter,
    apiLimiter,
    sensitiveLimiter
};