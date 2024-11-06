// app.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');

// Import des configurations et middlewares
const errorHandler = require('./middleware/errorHandler');
const databaseConfig = require('./config/database');
const { loggerMiddleware } = require('./middleware/logger');
const { authenticateJWT } = require('./middleware/auth');

// Import des routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const pinterestRoutes = require('./routes/pinterest.routes');

const app = express();

// Configuration de base
app.set('trust proxy', 1);

// Rate Limiter global
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        status: 'error',
        message: 'Trop de requêtes, veuillez réessayer plus tard'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Middlewares de base
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configuration de la session
const sessionConfig = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60,
        autoRemove: 'native'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
};

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
    sessionConfig.cookie.secure = true;
}

app.use(session(sessionConfig));

// Configuration CORS
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:3000',
            'https://advancev2-ezmp.vercel.app',
            /\.vercel\.app$/
        ];
        
        // Permettre les requêtes sans origine (ex: applications mobiles)
        if (!origin) {
            return callback(null, true);
        }

        const isAllowed = allowedOrigins.some(allowed => 
            allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
        );

        if (isAllowed) {
            callback(null, true);
        } else {
            callback(new Error('Non autorisé par CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Access-Control-Allow-Origin'],
    maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Initialisation de Passport
app.use(passport.initialize());
app.use(passport.session());
require('./config/passport');

// Logger en développement
if (process.env.NODE_ENV === 'development') {
    app.use(loggerMiddleware);
}

// Headers de sécurité
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// Connexion à la base de données
databaseConfig();

// Routes
app.use('/api/auth', limiter, authRoutes);
app.use('/api/user', limiter, userRoutes);
app.use('/api/pinterest', limiter, pinterestRoutes);

// Route de santé
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        services: {
            mongodb: {
                status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                version: mongoose.version
            },
            pinterest: {
                status: 'active',
                apiVersion: 'v5'
            }
        },
        memory: {
            usage: process.memoryUsage(),
            free: require('os').freemem(),
            total: require('os').totalmem()
        }
    });
});

// Route par défaut pour les chemins inconnus
app.use('*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route non trouvée'
    });
});

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
    console.error('🔥 Erreur:', err);

    if (err.message === 'Non autorisé par CORS') {
        return res.status(403).json({
            status: 'error',
            message: 'Accès non autorisé',
            code: 'CORS_ERROR'
        });
    }

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            status: 'error',
            message: 'Erreur de validation',
            errors: Object.values(err.errors).map(e => e.message)
        });
    }

    if (err.name === 'UnauthorizedError' || err.status === 401) {
        return res.status(401).json({
            status: 'error',
            message: 'Non autorisé',
            code: 'UNAUTHORIZED'
        });
    }

    res.status(err.status || 500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production' 
            ? 'Erreur interne du serveur'
            : err.message,
        code: err.code,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 Promesse non gérée:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('🔥 Exception non gérée:', error);
    if (process.env.NODE_ENV === 'production') {
        // Envoyer l'erreur à un service de monitoring
        process.exit(1);
    }
});

// Démarrage du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`
    🚀 Serveur démarré sur le port ${PORT}
    🌍 Environment: ${process.env.NODE_ENV}
    📍 URL: https://advancev2.onrender.com
    📊 MongoDB: ${mongoose.connection.readyState === 1 ? '🟢 Connected' : '🔴 Disconnected'}
    🔐 CORS: Configuré
    🛡️  Security: Enabled
    `);
});

module.exports = app;