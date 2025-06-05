const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.session.returnTo = req.originalUrl;
    req.flash('error_msg', 'Please log in to view this resource');
    res.redirect('/login');
};

module.exports = { isAuthenticated };