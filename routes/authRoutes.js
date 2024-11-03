const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Route d'inscription
router.post('/signup', authController.signup);

// Route de connexion
router.post('/login', authController.login);

// Vérification de l'existence d'un utilisateur
router.post('/check-user', authController.checkUser);

// Vérification de l'email
router.get('/verify-email', authController.verifyEmail);

// Renvoyer l'email de vérification
router.post('/resend-verification', authController.resendVerification);

// Routes Google OAuth
router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        try {
            // Générer le token JWT pour l'utilisateur Google
            const token = TokenService.generateAuthToken(req.user);
            
            // Rediriger vers le frontend avec le token
            const frontendUrl = process.env.NODE_ENV === 'production'
                ? process.env.FRONTEND_URL
                : 'http://localhost:3000';

            res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
        } catch (error) {
            console.error('Erreur lors de la connexion Google:', error);
            res.redirect(`${frontendUrl}/login?error=auth_failed`);
        }
    }
);

// Déconnexion
router.post('/logout', authenticateToken, (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la déconnexion'
            });
        }
        res.json({
            success: true,
            message: 'Déconnexion réussie'
        });
    });
});

// Vérifier si le token est valide
router.get('/verify-token', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            email: req.user.email
        }
    });
});

module.exports = router;