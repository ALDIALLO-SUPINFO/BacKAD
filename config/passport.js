const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.NODE_ENV === 'production'
                ? 'https://advancev2.onrender.com/api/auth/google/callback'
                : 'http://localhost:5000/api/auth/google/callback',
            userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Vérifier si l'utilisateur existe déjà
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    return done(null, user);
                }

                // Si l'utilisateur n'existe pas, vérifier si l'email est déjà utilisé
                const existingUser = await User.findOne({ email: profile.emails[0].value });
                if (existingUser) {
                    // Mettre à jour l'utilisateur existant avec les infos Google
                    existingUser.googleId = profile.id;
                    if (!existingUser.firstName) existingUser.firstName = profile.name.givenName;
                    if (!existingUser.lastName) existingUser.lastName = profile.name.familyName;
                    if (!existingUser.avatar) existingUser.avatar = profile.photos[0]?.value;
                    await existingUser.save();
                    return done(null, existingUser);
                }

                // Créer un nouvel utilisateur
                const newUser = await User.create({
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    firstName: profile.name.givenName,
                    lastName: profile.name.familyName,
                    avatar: profile.photos[0]?.value,
                    verified: true, // Les utilisateurs Google sont automatiquement vérifiés
                    credits: 100 // Crédits de bienvenue
                });

                done(null, newUser);
            } catch (error) {
                console.error('Erreur Passport Google:', error);
                done(error, null);
            }
        }
    )
);

// Pour les besoins de débogage
if (process.env.NODE_ENV === 'development') {
    passport.use('mock-google',
        new GoogleStrategy(
            {
                clientID: 'mock-client-id',
                clientSecret: 'mock-client-secret',
                callbackURL: 'http://localhost:5000/api/auth/google/callback'
            },
            async (accessToken, refreshToken, profile, done) => {
                // Créer un utilisateur de test
                const mockUser = {
                    _id: 'mock-user-id',
                    googleId: 'mock-google-id',
                    email: 'test@example.com',
                    firstName: 'Test',
                    lastName: 'User',
                    verified: true,
                    credits: 100
                };
                done(null, mockUser);
            }
        )
    );
}

module.exports = passport;