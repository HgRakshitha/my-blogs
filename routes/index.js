const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/user');
const Post = require('../models/posts');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailSender');

router.get('/', async (req, res) => {
    try {
        const posts = await Post.find({})
            .populate('author', 'name')
            .sort({ createdAt: 'desc' })
            .lean();
        res.render('home', {
            title: 'Home',
            posts: posts
        });
    } catch (err) {
        console.error("Error fetching posts for home page:", err);
        res.render('error', {
            title: 'Error',
            message: 'Could not load posts at this time.',
            error: process.env.NODE_ENV !== 'production' ? err : {}
        });
    }
});

router.get('/login', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/dashboard');
    res.render('login', { title: 'Login' });
});

router.get('/register', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/dashboard');
    res.render('registration', { title: 'Register' });
});

router.post('/register', async (req, res) => {
    const { name, email, password, password2 } = req.body;
    let errors = [];

    if (!name || !email || !password || !password2) {
        errors.push({ msg: 'Please enter all fields' });
    }
    if (password !== password2) {
        errors.push({ msg: 'Passwords do not match' });
    }
    if (password.length < 6) {
        errors.push({ msg: 'Password must be at least 6 characters' });
    }

    if (errors.length > 0) {
        return res.render('registration', {
            title: 'Register',
            errors,
            name,
            email
        });
    }
    try {
        const normalizedEmail = email.toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            errors.push({ msg: 'Email already exists' });
            return res.render('registration', {
                title: 'Register',
                errors,
                name,
                email
            });
        }
        const newUser = new User({
            name,
            email: normalizedEmail,
            password
        });
        
        const verificationToken = newUser.generateEmailVerificationToken();
        await newUser.save();

        try {
            await sendVerificationEmail(newUser.email, verificationToken, req);
        } catch (emailError) {
            console.error("Failed to send verification email during registration:", emailError.message);
        }

        req.flash('success_msg', 'Registration successful! Please check your email to verify your account.');
        res.redirect('/login');
    } catch (err) {
        console.error("Error during registration:", err);
        errors.push({ msg: 'Something went wrong during registration. Please try again.' });
        res.render('registration', {
            title: 'Register',
            errors,
            name,
            email
        });
    }
});

router.get('/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token) {
        req.flash('error_msg', 'Verification token is missing.');
        return res.redirect('/login');
    }

    try {
        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationTokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error_msg', 'Verification token is invalid or has expired.');
            return res.redirect('/register');
        }

        user.isVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationTokenExpires = undefined;
        await user.save();

        req.flash('success_msg', 'Email verified successfully! You can now log in.');
        res.redirect('/login');

    } catch (err) {
        console.error("Error during email verification:", err);
        req.flash('error_msg', 'Something went wrong during email verification.');
        res.redirect('/login');
    }
});

router.post('/login', (req, res, next) => {
    const { email } = req.body;
    if (email && typeof email === 'string') {
        req.body.email = email.toLowerCase();
    }
    passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err); }
        if (!user) {
            req.flash('error_msg', info.message);
            return res.redirect('/login');
        }
        if (!user.isVerified) {
            req.flash('error_msg', 'Please verify your email before logging in. Check your inbox for the verification link.');
            return res.redirect('/login');
        }
        req.logIn(user, function(err) {
            if (err) { return next(err); }
            return res.redirect('/dashboard');
        });
    })(req, res, next);
});


router.get('/logout', (req, res, next) => {
    req.logout(function(err) {
        if (err) {
            console.error("Error during logout:", err);
            req.flash('error_msg', 'Could not log out. Please try again.');
            return res.redirect('/');
        }
        req.flash('success_msg', 'You are logged out');
        res.redirect('/login');
    });
});

router.get('/dashboard', isAuthenticated, (req, res) => {
    res.render('dashboard', {
        title: 'Dashboard',
        path: req.path
    });
});

router.get('/users/edit-profile', isAuthenticated, (req, res) => {
    res.render('users/edit-profile', {
        title: 'Edit Profile',
        path: req.path
    });
});

router.post('/users/edit-profile', isAuthenticated, async (req, res) => {
    const { name, email } = req.body;
    const userId = req.user._id;
    let errors = [];

    if (!name || !email) {
        errors.push({ msg: 'Please fill in name and email.' });
    }
    
    if (errors.length > 0) {
        return res.render('users/edit-profile', {
            title: 'Edit Profile',
            errors,
            path: req.path,
        });
    }

    try {
        const userToUpdate = await User.findById(userId);
        if (!userToUpdate) {
            req.flash('error_msg', 'User not found.');
            return res.redirect('/dashboard');
        }

        let emailChangedAndNeedsReVerification = false;
        const normalizedEmail = email.toLowerCase();

        if (normalizedEmail !== userToUpdate.email) {
            const existingEmailUser = await User.findOne({ email: normalizedEmail });
            if (existingEmailUser && existingEmailUser._id.toString() !== userId.toString()) {
                errors.push({ msg: 'That email is already registered by another user.'});
                return res.render('users/edit-profile', {
                    title: 'Edit Profile',
                    errors,
                    path: req.path
                });
            }
            userToUpdate.email = normalizedEmail;
            userToUpdate.isVerified = false;
            const verificationToken = userToUpdate.generateEmailVerificationToken();
            emailChangedAndNeedsReVerification = true;
            try {
                await sendVerificationEmail(userToUpdate.email, verificationToken, req);
            } catch (emailError) {
                 console.error("Failed to send re-verification email during profile update:", emailError.message);
            }
            req.flash('info_msg', 'Email changed. Please check your new email address to re-verify your account.');
        }
        
        userToUpdate.name = name;
        await userToUpdate.save();
        
        if (!emailChangedAndNeedsReVerification) {
            req.flash('success_msg', 'Profile updated successfully.');
        }

        if (emailChangedAndNeedsReVerification) {
             req.logout(function(err) {
                if (err) { console.error("Error during logout after email change:", err); }
                return res.redirect('/login');
            });
        } else {
            res.redirect('/dashboard');
        }

    } catch (err) {
        console.error('Error updating profile:', err);
        req.flash('error_msg', 'Something went wrong. Could not update profile.');
        res.redirect('/users/edit-profile');
    }
});

router.get('/forgot-password', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/dashboard');
    res.render('forgot-password', { title: 'Forgot Password' });
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    let errors = [];

    if (!email) {
        errors.push({ msg: 'Please enter your email address.' });
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        errors.push({ msg: 'Please enter a valid email address.' });
    }

    if (errors.length > 0) {
        return res.render('forgot-password', {
            title: 'Forgot Password',
            errors,
            email
        });
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            req.flash('success_msg', 'If an account with that email exists, a password reset link has been sent.');
            return res.redirect('/forgot-password');
        }

        const resetToken = user.generatePasswordResetToken();
        await user.save({ validateBeforeSave: false });

        try {
            await sendPasswordResetEmail(user.email, resetToken, req);
            req.flash('success_msg', 'A password reset link has been sent to your email address.');
        } catch (emailError) {
            console.error("Failed to send password reset email:", emailError.message);
            req.flash('error_msg', 'Could not send password reset email. Please try again later.');
        }
        res.redirect('/forgot-password');
    } catch (err) {
        console.error("Error in forgot password process:", err);
        req.flash('error_msg', 'An unexpected error occurred. Please try again.');
        res.redirect('/forgot-password');
    }
});

router.get('/reset-password/:token', async (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/dashboard');
    const { token } = req.params;

    try {
        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetTokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error_msg', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot-password');
        }

        res.render('reset-password', {
            title: 'Reset Password',
            token: token
        });
    } catch (err) {
        console.error("Error displaying reset password form:", err);
        req.flash('error_msg', 'An error occurred.');
        res.redirect('/forgot-password');
    }
});

router.get('/search', async (req, res) => {
    const searchQuery = req.query.query;
    let posts = [];
    let errors = []; 

    if (searchQuery && searchQuery.trim() !== '') {
        try {
            posts = await Post.find(
                { $text: { $search: searchQuery } },
                { score: { $meta: "textScore" } }
            )
            .populate('author', 'name')
            .sort({ score: { $meta: "textScore" } })
            .lean();

            if (posts.length === 0) {
                errors.push({ msg: `No posts found matching "${searchQuery}".` });
            }

        } catch (err) {
            console.error("Error during search:", err);
            errors.push({ msg: 'An error occurred while searching. Please try again.' });
        }
    } else {
        
    }

    res.render('search-results', {
        title: searchQuery ? `Search Results for "${searchQuery}"` : 'Search Posts',
        searchQuery: searchQuery,
        posts: posts,
        errors: errors 
    });
});



module.exports = router;