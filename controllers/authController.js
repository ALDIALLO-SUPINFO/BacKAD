const bcrypt = require('bcrypt');
const User = require('../models/User');
const TokenService = require('../services/tokenService');
const EmailService = require('../services/emailService');

class AuthController {
    async signup(req, res, next) {
        try {
            const { email, password, firstName } = req.body;

            // Vérifier si l'utilisateur existe déjà
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Un compte existe déjà avec cet email'
                });
            }

            // Hasher le mot de passe
            const hashedPassword = await bcrypt.hash(password, 10);

            // Générer le token de vérification
            const verificationToken = TokenService.generateVerificationToken();

            // Créer le nouvel utilisateur
            const newUser = new User({
                email,
                password: hashedPassword,
                firstName,
                credits: 100,
                verificationToken,
                verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 heures
                verified: false
            });

            await newUser.save();

            // Envoyer l'email de vérification
            await EmailService.sendVerificationEmail(email, firstName, verificationToken);

            // Générer le token JWT
            const authToken = TokenService.generateAuthToken(newUser);

            res.status(201).json({
                success: true,
                message: 'Compte créé avec succès, veuillez vérifier votre email',
                token: authToken,
                user: {
                    email: newUser.email,
                    firstName: newUser.firstName,
                    credits: newUser.credits,
                    verified: false
                }
            });
        } catch (error) {
            next(error);
        }
    }

    async login(req, res, next) {
        try {
            const { email, password } = req.body;

            // Trouver l'utilisateur
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: 'Identifiants incorrects'
                });
            }

            // Vérifier le mot de passe
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Identifiants incorrects'
                });
            }

            // Générer le token
            const token = TokenService.generateAuthToken(user);

            res.json({
                success: true,
                token,
                user: {
                    email: user.email,
                    firstName: user.firstName,
                    credits: user.credits,
                    avatar: user.avatar,
                    isPremium: user.isPremium,
                    verified: user.verified
                }
            });
        } catch (error) {
            next(error);
        }
    }

    async verifyEmail(req, res, next) {
        try {
            const { token } = req.query;

            const user = await User.findOne({
                verificationToken: token,
                verificationTokenExpires: { $gt: Date.now() }
            });

            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: 'Token de vérification invalide ou expiré'
                });
            }

            user.verified = true;
            user.verificationToken = undefined;
            user.verificationTokenExpires = undefined;
            await user.save();

            res.json({
                success: true,
                message: 'Email vérifié avec succès'
            });
        } catch (error) {
            next(error);
        }
    }

    async resendVerification(req, res, next) {
        try {
            const { email } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur non trouvé'
                });
            }

            if (user.verified) {
                return res.status(400).json({
                    success: false,
                    message: 'Cet email est déjà vérifié'
                });
            }

            const verificationToken = TokenService.generateVerificationToken();
            user.verificationToken = verificationToken;
            user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await user.save();

            await EmailService.sendVerificationEmail(email, user.firstName, verificationToken);

            res.json({
                success: true,
                message: 'Email de vérification renvoyé'
            });
        } catch (error) {
            next(error);
        }
    }

    async checkUser(req, res, next) {
        try {
            const { email } = req.body;

            const user = await User.findOne({ email });
            
            res.json({
                success: true,
                exists: !!user,
                provider: user?.googleId ? 'google' : user ? 'local' : null
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();