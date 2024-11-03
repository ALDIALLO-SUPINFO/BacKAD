const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class TokenService {
    generateAuthToken(user) {
        return jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
    }

    generateVerificationToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    verifyToken(token) {
        return jwt.verify(token, process.env.JWT_SECRET);
    }
}

module.exports = new TokenService();