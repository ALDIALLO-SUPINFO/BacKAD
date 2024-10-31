require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));
app.use(cors({
    origin: ['http://localhost:3000', 'https://advancev2-ezmp.vercel.app'],
    credentials: true
  }));
  
app.use(passport.initialize());
app.use(passport.session());

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connecté'))
    .catch((error) => console.error('Erreur de connexion à MongoDB', error));

// Modèle d'utilisateur mis à jour
const userSchema = new mongoose.Schema({
    googleId: String,
    email: { type: String, required: true, unique: true },
    password: String,
    firstName: String,
    lastName: String,
    credits: { type: Number, default: 0 },
    avatar: String,
    isPremium: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Middleware d'authentification JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token manquant' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token invalide' });
        }
        req.user = user;
        next();
    });
};

// Configuration de Passport avec la stratégie Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
            user = await User.create({
                googleId: profile.id,
                email: profile.emails[0].value,
                firstName: profile.name.givenName,
                lastName: profile.name.familyName,
                avatar: profile.photos[0]?.value
            });
        }
        done(null, user);
    } catch (error) {
        done(error, null);
    }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => done(err, user));
});

// Route pour récupérer le profil utilisateur
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            credits: user.credits,
            avatar: user.avatar,
            isPremium: user.isPremium
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du profil:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route de connexion mise à jour avec JWT
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: 'Utilisateur non trouvé' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            // Générer le token JWT
            const token = jwt.sign(
                { id: user._id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.json({
                success: true,
                token,
                user: {
                    email: user.email,
                    firstName: user.firstName,
                    credits: user.credits,
                    avatar: user.avatar,
                    isPremium: user.isPremium
                }
            });
        } else {
            return res.json({ success: false, message: 'Mot de passe incorrect' });
        }
    } catch (error) {
        console.error("Erreur lors de la connexion:", error);
        return res.status(500).json({ success: false, message: 'Erreur de connexion' });
    }
});

// Route d'inscription mise à jour
app.post('/api/signup', async (req, res) => {
    const { email, password, firstName } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            email,
            password: hashedPassword,
            firstName,
            credits: 100 // Crédits de bienvenue
        });
        await newUser.save();

        // Générer le token JWT pour la connexion automatique
        const token = jwt.sign(
            { id: newUser._id, email: newUser.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                email: newUser.email,
                firstName: newUser.firstName,
                credits: newUser.credits
            }
        });
    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur:', error);
        res.status(500).json({ message: 'Erreur lors de l\'inscription' });
    }
});

// Route pour la modification du profil
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, avatar } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { firstName, lastName, avatar },
            { new: true }
        ).select('-password');

        res.json(updatedUser);
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du profil' });
    }
});

// Route pour gérer les crédits
app.put('/api/user/credits', authenticateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.user.id);
        user.credits += amount;
        await user.save();

        res.json({ credits: user.credits });
    } catch (error) {
        console.error('Erreur lors de la mise à jour des crédits:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour des crédits' });
    }
});

// Routes Google Auth
app.get('/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    async (req, res) => {
        const token = jwt.sign(
            { id: req.user._id, email: req.user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.redirect(`http://localhost:3000/auth/callback?token=${token}`);
    }
);

// Démarrage du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));