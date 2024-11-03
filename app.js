require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');

const errorHandler = require('./middleware/errorHandler');
const databaseConfig = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// Middlewares de base
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

// Configuration CORS
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://advancev2-ezmp.vercel.app',
        /\.vercel\.app$/
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Access-Control-Allow-Origin'],
    maxAge: 86400
}));

app.options('*', cors());

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());
require('./config/passport');

// Connexion à la base de données
databaseConfig();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// Route de santé
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Middleware d'erreur
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`
    🚀 Serveur démarré sur le port ${PORT}
    🌍 Environment: ${process.env.NODE_ENV}
    📍 URL: https://advancev2.onrender.com
    `);
});

module.exports = app;