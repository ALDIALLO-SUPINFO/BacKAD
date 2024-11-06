// src/models/PinterestAccount.js

const mongoose = require('mongoose');

const pinterestAccountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    pinterestId: {
        type: String,
        required: true,
        unique: true
    },
    accessToken: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String
    },
    username: {
        type: String,
        required: true
    },
    email: String,
    profileImage: String,
    isConnected: {
        type: Boolean,
        default: true
    },
    lastTokenRefresh: {
        type: Date,
        default: Date.now
    },
    adAccounts: [{
        id: String,
        name: String,
        status: {
            type: String,
            enum: ['ACTIVE', 'INACTIVE', 'PENDING'],
            default: 'PENDING'
        },
        currency: String,
        country: String,
        lastSync: Date
    }],
    settings: {
        defaultCurrency: {
            type: String,
            default: 'EUR'
        },
        defaultLanguage: {
            type: String,
            default: 'fr'
        },
        notificationsEnabled: {
            type: Boolean,
            default: true
        }
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
        default: 'ACTIVE'
    },
    errors: [{
        code: String,
        message: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Index pour améliorer les performances des requêtes
pinterestAccountSchema.index({ userId: 1, isConnected: 1 });
pinterestAccountSchema.index({ pinterestId: 1 });

// Méthode pour vérifier si le token est expiré
pinterestAccountSchema.methods.isTokenExpired = function() {
    const tokenAge = Date.now() - this.lastTokenRefresh.getTime();
    const tokenMaxAge = 30 * 24 * 60 * 60 * 1000; // 30 jours
    return tokenAge > tokenMaxAge;
};

// Méthode pour mettre à jour le token
pinterestAccountSchema.methods.updateToken = async function(newToken, newRefreshToken) {
    this.accessToken = newToken;
    if (newRefreshToken) {
        this.refreshToken = newRefreshToken;
    }
    this.lastTokenRefresh = new Date();
    this.isConnected = true;
    return this.save();
};

// Méthode pour ajouter ou mettre à jour un compte publicitaire
pinterestAccountSchema.methods.updateAdAccount = async function(adAccountData) {
    const existingIndex = this.adAccounts.findIndex(acc => acc.id === adAccountData.id);
    
    if (existingIndex > -1) {
        this.adAccounts[existingIndex] = {
            ...this.adAccounts[existingIndex],
            ...adAccountData,
            lastSync: new Date()
        };
    } else {
        this.adAccounts.push({
            ...adAccountData,
            lastSync: new Date()
        });
    }

    return this.save();
};

// Méthode pour enregistrer une erreur
pinterestAccountSchema.methods.logError = async function(code, message) {
    this.errors.push({ code, message });
    if (this.errors.length > 100) { // Garder seulement les 100 dernières erreurs
        this.errors = this.errors.slice(-100);
    }
    return this.save();
};

// Hook pre-save pour nettoyer les données
pinterestAccountSchema.pre('save', function(next) {
    // Nettoyer le username
    if (this.username) {
        this.username = this.username.trim();
    }

    // Vérifier si le compte doit être marqué comme inactif
    if (this.isTokenExpired()) {
        this.isConnected = false;
    }

    next();
});

const PinterestAccount = mongoose.model('PinterestAccount', pinterestAccountSchema);

module.exports = PinterestAccount;