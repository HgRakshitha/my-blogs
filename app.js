const { config } = require('dotenv');
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const passportMiddleware = require('./config/passport');

config();
const app = express();

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB Error:', err));

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: true,
        saveUninitialized: true
    })
);

app.use(passport.initialize());
app.use(passport.session());

passportMiddleware(passport);

app.use(flash());

app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.currentUser = req.user || null;
    next();
});

app.use('/', require('./routes/index'));
app.use('/posts', require('./routes/posts'));

app.use((req, res, next) => {
    const error = new Error('Page Not Found');
    error.status = 404;
    next(error);
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.status || 500;
    res.status(status).render('error', {
        title: 'Error',
        message: err.message || 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err : {},
        currentUser: req.user
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server started on http://localhost:${PORT}`));
