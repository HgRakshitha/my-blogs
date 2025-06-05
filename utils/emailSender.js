const nodemailer = require('nodemailer');
require('dotenv').config();

const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail', 
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
        }
    });
};

const sendVerificationEmail = async (userEmail, token, req) => {
    const transporter = createTransporter();
    const verificationLink = `http://${req.headers.host}/verify-email?token=${token}`;
    const mailOptions = {
        from: `"My Blog App" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: 'Verify Your Email Address for My Blog App',
        text: `Hello,\n\nPlease verify your email address by clicking the following link: \n${verificationLink}\n\nIf you did not request this, please ignore this email.\n\nThanks,\nThe My Blog App Team`,
        html: `<p>Hello,</p><p>Please verify your email address by clicking the link below:</p><p><a href="${verificationLink}">Verify Email Address</a></p><p>If you did not create an account, no further action is required.</p><p>Thanks,<br>The My Blog App Team</p>`
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log('Verification email sent to:', userEmail);
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw error;
    }
};

const sendPasswordResetEmail = async (userEmail, token, req) => {
    const transporter = createTransporter();
    const resetLink = `http://${req.headers.host}/reset-password/${token}`; 
    const mailOptions = {
        from: `"My Blog App" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: 'Password Reset Request for My Blog App',
        text: `Hello,\n\nYou are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\nPlease click on the following link, or paste this into your browser to complete the process:\n${resetLink}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\nThis link will expire in 1 hour.\n\nThanks,\nThe My Blog App Team`,
        html: `<p>Hello,</p><p>You are receiving this email because you (or someone else) have requested the reset of the password for your account.</p><p>Please click on the following link to complete the process:</p><p><a href="${resetLink}">Reset Your Password</a></p><p>If you did not request this, please ignore this email and your password will remain unchanged.</p><p>This link will expire in 1 hour.</p><p>Thanks,<br>The My Blog App Team</p>`
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log('Password reset email sent to:', userEmail);
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw error;
    }
};


module.exports = { sendVerificationEmail, sendPasswordResetEmail }; 