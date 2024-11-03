const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

// Middleware d'authentification pour toutes les routes utilisateur
router.use(authenticateToken);

// Obtenir le profil de l'utilisateur
router.get('/profile', userController.getProfile);

// Mettre à jour le profil de l'utilisateur
router.put('/profile', userController.updateProfile);

// Mettre à jour les crédits de l'utilisateur
router.put('/credits', userController.updateCredits);

// Obtenir les statistiques de l'utilisateur
router.get('/stats', async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        // Calculer les statistiques de l'utilisateur
        // À personnaliser selon vos besoins
        const stats = {
            totalCredits: user.credits,
            memberSince: user.createdAt,
            isPremium: user.isPremium,
            lastActivity: user.lastActivity || null,
            // Ajoutez d'autres statistiques selon vos besoins
        };

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        next(error);
    }
});

// Route pour la mise à jour du mot de passe
router.put('/password', async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Trouver l'utilisateur
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        // Vérifier l'ancien mot de passe
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Mot de passe actuel incorrect'
            });
        }

        // Hasher et sauvegarder le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Mot de passe mis à jour avec succès'
        });
    } catch (error) {
        next(error);
    }
});

// Route pour supprimer le compte
router.delete('/account', async (req, res, next) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        // Vérifier le mot de passe avant la suppression
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Mot de passe incorrect'
            });
        }

        await User.findByIdAndDelete(req.user.id);

        res.json({
            success: true,
            message: 'Compte supprimé avec succès'
        });
    } catch (error) {
        next(error);
    }
});

// Route pour obtenir les notifications de l'utilisateur
router.get('/notifications', async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)
            .select('notifications')
            .populate('notifications');

        res.json({
            success: true,
            notifications: user.notifications || []
        });
    } catch (error) {
        next(error);
    }
});

// Route pour marquer une notification comme lue
router.put('/notifications/:id/read', async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        // Mettre à jour le statut de la notification
        const notification = user.notifications.id(id);
        if (notification) {
            notification.read = true;
            await user.save();
        }

        res.json({
            success: true,
            message: 'Notification marquée comme lue'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;