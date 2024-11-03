const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    googleId: String,
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: String,
    firstName: String,
    lastName: String,
    credits: { 
        type: Number, 
        default: 0 
    },
    avatar: String,
    isPremium: { 
        type: Boolean, 
        default: false 
    },
    verified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('User', userSchema);