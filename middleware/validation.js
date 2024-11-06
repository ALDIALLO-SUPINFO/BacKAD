// src/middleware/validation.js

const { check, validationResult } = require('express-validator');

// Middleware de validation générique
const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Erreur de validation',
                errors: errors.array()
            });
        }
        next();
    };
};

// Validation pour les campagnes Pinterest
const validatePinterestCampaign = validate([
    check('name')
        .trim()
        .notEmpty().withMessage('Le nom est requis')
        .isLength({ min: 3, max: 100 }).withMessage('Le nom doit contenir entre 3 et 100 caractères'),
    
    check('objective')
        .notEmpty().withMessage('L\'objectif est requis')
        .isIn(['AWARENESS', 'CONSIDERATION', 'CONVERSION'])
        .withMessage('Objectif invalide'),
    
    check('dailyBudget')
        .notEmpty().withMessage('Le budget quotidien est requis')
        .isFloat({ min: 1 }).withMessage('Le budget quotidien doit être supérieur à 1'),
    
    check('startDate')
        .notEmpty().withMessage('La date de début est requise')
        .isISO8601().withMessage('Format de date invalide')
        .custom((value) => {
            if (new Date(value) < new Date()) {
                throw new Error('La date de début doit être dans le futur');
            }
            return true;
        }),
    
    check('endDate')
        .optional()
        .isISO8601().withMessage('Format de date invalide')
        .custom((value, { req }) => {
            if (value && new Date(value) <= new Date(req.body.startDate)) {
                throw new Error('La date de fin doit être après la date de début');
            }
            return true;
        }),
    
    check('targeting.locations')
        .optional()
        .isArray().withMessage('Les locations doivent être un tableau'),
    
    check('targeting.ageRange')
        .optional()
        .isObject().withMessage('La tranche d\'âge doit être un objet')
        .custom((value) => {
            if (value.min && (value.min < 18 || value.min > 65)) {
                throw new Error('L\'âge minimum doit être entre 18 et 65');
            }
            if (value.max && (value.max < 18 || value.max > 65)) {
                throw new Error('L\'âge maximum doit être entre 18 et 65');
            }
            if (value.min && value.max && value.min > value.max) {
                throw new Error('L\'âge minimum doit être inférieur à l\'âge maximum');
            }
            return true;
        }),
    
    check('targeting.gender')
        .optional()
        .isIn(['ALL', 'MALE', 'FEMALE'])
        .withMessage('Genre invalide')
]);

// Validation pour la mise à jour du statut de la campagne
const validateCampaignStatusUpdate = validate([
    check('status')
        .notEmpty().withMessage('Le statut est requis')
        .isIn(['ACTIVE', 'PAUSED', 'ARCHIVED'])
        .withMessage('Statut invalide')
]);

// Validation pour les paramètres d'analyse
const validateAnalyticsParams = validate([
    check('startDate')
        .notEmpty().withMessage('La date de début est requise')
        .isISO8601().withMessage('Format de date invalide'),
    
    check('endDate')
        .notEmpty().withMessage('La date de fin est requise')
        .isISO8601().withMessage('Format de date invalide')
        .custom((value, { req }) => {
            if (new Date(value) <= new Date(req.query.startDate)) {
                throw new Error('La date de fin doit être après la date de début');
            }
            return true;
        }),
    
    check('metrics')
        .optional()
        .isArray().withMessage('Les métriques doivent être un tableau')
]);

module.exports = {
    validatePinterestCampaign,
    validateCampaignStatusUpdate,
    validateAnalyticsParams
};
