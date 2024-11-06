// src/config/passport.js

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const User = require('../models/User');

// Sérialisation de l'utilisateur
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Désérialisation de l'utilisateur
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id).select('-password');
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Configuration de la stratégie JWT
const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
    passReqToCallback: true
};

passport.use(new JwtStrategy(jwtOptions, async (req, payload, done) => {
    try {
        const user = await User.findById(payload.id).select('-password');
        
        if (!user) {
            return done(null, false, { message: 'Utilisateur non trouvé' });
        }

        // Vérifier si le token n'est pas expiré
        const tokenExp = payload.exp * 1000;
        if (Date.now() >= tokenExp) {
            return done(null, false, { message: 'Token expiré' });
        }

        // Vérifier si l'utilisateur est actif
        if (!user.isActive) {
            return done(null, false, { message: 'Compte désactivé' });
        }

        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

// Configuration de la stratégie Google OAuth
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.NODE_ENV === 'production'
                ? 'https://advancev2.onrender.com/api/auth/google/callback'
                : 'http://localhost:5000/api/auth/google/callback',
            userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
            passReqToCallback: true
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                // Vérifier si l'utilisateur existe déjà
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    // Mettre à jour les dernières informations
                    user.lastLogin = new Date();
                    user.googleAccessToken = accessToken;
                    if (refreshToken) user.googleRefreshToken = refreshToken;
                    
                    // Mettre à jour les informations du profil si nécessaire
                    if (profile.photos?.[0]?.value) {
                        user.avatar = profile.photos[0].value;
                    }
                    
                    await user.save();
                    return done(null, user);
                }

                // Vérifier si l'email est déjà utilisé
                const existingUser = await User.findOne({ email: profile.emails[0].value });
                if (existingUser) {
                    // Mettre à jour l'utilisateur existant avec les infos Google
                    existingUser.googleId = profile.id;
                    existingUser.googleAccessToken = accessToken;
                    existingUser.googleRefreshToken = refreshToken;
                    existingUser.lastLogin = new Date();
                    
                    if (!existingUser.firstName) existingUser.firstName = profile.name.givenName;
                    if (!existingUser.lastName) existingUser.lastName = profile.name.familyName;
                    if (!existingUser.avatar && profile.photos?.[0]?.value) {
                        existingUser.avatar = profile.photos[0].value;
                    }
                    
                    await existingUser.save();
                    return done(null, existingUser);
                }

                // Créer un nouvel utilisateur
                const newUser = await User.create({
                    googleId: profile.id,
                    googleAccessToken: accessToken,
                    googleRefreshToken: refreshToken,
                    email: profile.emails[0].value,
                    firstName: profile.name.givenName,
                    lastName: profile.name.familyName,
                    avatar: profile.photos?.[0]?.value,
                    verified: true,
                    isActive: true,
                    credits: 100,
                    lastLogin: new Date(),
                    settings: {
                        language: req.headers['accept-language']?.split(',')[0] || 'fr',
                        timezone: 'Europe/Paris',
                        notifications: {
                            email: true,
                            push: true
                        }
                    }
                });

                // Log de création d'utilisateur
                console.log('✨ Nouvel utilisateur créé via Google:', {
                    id: newUser._id,
                    email: newUser.email,
                    firstName: newUser.firstName
                });

                done(null, newUser);
            } catch (error) {
                console.error('🔥 Erreur Passport Google:', error);
                done(error, null);
            }
        }
    )
);

// Middleware d'authentification personnalisé
const authenticateJWT = (req, res, next) => {
    passport.authenticate('jwt', { session: false }, (err, user, info) => {
        if (err) {
            return next(err);
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: info?.message || 'Non autorisé',
                code: 'UNAUTHORIZED'
            });
        }

        req.user = user;
        next();
    })(req, res, next);
};

// Middleware d'authentification Google
const authenticateGoogle = passport.authenticate('google', {
    scope: [
        'profile',
        'email'
    ],
    accessType: 'offline',
    prompt: 'consent'
});

// Test mock en développement
if (process.env.NODE_ENV === 'development') {
    passport.use('mock-google',
        new GoogleStrategy(
            {
                clientID: 'mock-client-id',
                clientSecret: 'mock-client-secret',
                callbackURL: 'http://localhost:5000/api/auth/google/callback'
            },
            async (accessToken, refreshToken, profile, done) => {
                const mockUser = {
                    _id: 'mock-user-id',
                    googleId: 'mock-google-id',
                    email: 'test@example.com',
                    firstName: 'Test',
                    lastName: 'User',
                    verified: true,
                    credits: 100,
                    isActive: true
                };
                done(null, mockUser);
            }
        )
    );
}

module.exports = {
    passport,
    authenticateJWT,
    authenticateGoogle
};