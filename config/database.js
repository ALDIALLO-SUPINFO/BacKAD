// src/config/database.js

const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 MongoDB connecté');
        
        // Gestion des événements de connexion
        mongoose.connection.on('error', err => {
            console.error('❌ Erreur MongoDB:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('🔌 MongoDB déconnecté');
        });

        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('MongoDB déconnecté à cause de l\'arrêt de l\'application');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Erreur de connexion à MongoDB:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;