const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    emailVerificationTokenExpires: Date,
    passwordResetToken: String,
    passwordResetTokenExpires: Date
});

UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

UserSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.generateEmailVerificationToken = function() {
    const verificationToken = crypto.randomBytes(20).toString('hex');
    this.emailVerificationToken = verificationToken;
    this.emailVerificationTokenExpires = Date.now() + 3600000; 
    return verificationToken;
};
UserSchema.methods.generatePasswordResetToken = function() {
    const resetToken = crypto.randomBytes(20).toString('hex');
    this.passwordResetToken = resetToken;
    this.passwordResetTokenExpires = Date.now() + 3600000; 
    return resetToken;
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);