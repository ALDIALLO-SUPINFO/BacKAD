const User = require('../models/User');

class UserController {
    async getProfile(req, res, next) {
        try {
            const user = await User.findById(req.user.id).select('-password');
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur non trouvé'
                });
            }

            res.json({
                success: true,
                user: {
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
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

    async updateProfile(req, res, next) {
        try {
            const { firstName, lastName, avatar } = req.body;

            const updatedUser = await User.findByIdAndUpdate(
                req.user.id,
                { firstName, lastName, avatar },
                { new: true }
            ).select('-password');

            if (!updatedUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur non trouvé'
                });
            }

            res.json({
                success: true,
                user: {
                    email: updatedUser.email,
                    firstName: updatedUser.firstName,
                    lastName: updatedUser.lastName,
                    avatar: updatedUser.avatar,
                    credits: updatedUser.credits,
                    isPremium: updatedUser.isPremium,
                    verified: updatedUser.verified
                }
            });
        } catch (error) {
            next(error);
        }
    }

    async updateCredits(req, res, next) {
        try {
            const { amount } = req.body;

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur non trouvé'
                });
            }

            user.credits += Number(amount);
            await user.save();

            res.json({
                success: true,
                credits: user.credits
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new UserController();