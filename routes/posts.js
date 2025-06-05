const express = require('express');
const router = express.Router();
const Post = require('../models/posts');
const { isAuthenticated } = require('../middleware/authMiddleware');

router.get('/new', isAuthenticated, (req, res) => {
    res.render('create-post', {
        title: 'Create New Post',
        path: req.path,
        titleValue: '',
        contentValue: '',
        imageUrlValue: ''
    });
});

router.post('/', isAuthenticated, async (req, res) => {
    const { title, content, imageUrl } = req.body;
    let errors = [];

    if (!title || !content) {
        errors.push({ msg: 'Please fill in both title and content.' });
    }

    if (errors.length > 0) {
        return res.render('create-post', {
            title: 'Create New Post',
            errors,
            titleValue: title,
            contentValue: content,
            imageUrlValue: imageUrl,
            path: '/posts/new'
        });
    }

    try {
        const newPost = new Post({
            title,
            content,
            imageUrl,
            author: req.user._id
        });
        await newPost.save();
        req.flash('success_msg', 'Post created successfully!');
        res.redirect('/posts/my-posts');
    } catch (err) {
        console.error("Error creating post:", err);
        errors.push({ msg: 'Could not save the post. Please try again.' });
        res.render('create-post', {
            title: 'Create New Post',
            errors,
            titleValue: title,
            contentValue: content,
            imageUrlValue: imageUrl,
            path: '/posts/new'
        });
    }
});

router.get('/my-posts', isAuthenticated, async (req, res) => {
    try {
        const posts = await Post.find({ author: req.user._id })
            .sort({ createdAt: 'desc' })
            .lean();
        res.render('my-posts', {
            title: 'My Posts',
            posts: posts,
            path: req.path
        });
    } catch (err) {
        console.error("Error fetching user's posts:", err);
        req.flash('error_msg', 'Could not load your posts.');
        res.redirect('/dashboard');
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('author', 'name');
        if (!post) {
            const err = new Error('Post Not Found');
            err.status = 404;
            return next(err);
        }
        res.render('view-post', {
            title: post.title,
            post: post
        });
    } catch (err) {
        console.error("Error fetching post by ID:", err);
        if (err.kind === 'ObjectId' && err.name === 'CastError') {
            const e = new Error('Post Not Found - Invalid ID Format');
            e.status = 404;
            return next(e);
        }
        next(err);
    }
});

router.get('/edit/:id', isAuthenticated, async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            req.flash('error_msg', 'Post not found.');
            return res.redirect('/posts/my-posts');
        }
        if (post.author.toString() !== req.user._id.toString()) {
            req.flash('error_msg', 'Not authorized to edit this post.');
            return res.redirect('/posts/my-posts');
        }
        res.render('edit-post', {
            title: 'Edit Post: ' + post.title,
            post: post,
            path: req.path
        });
    } catch (err) {
        next(err);
    }
});

router.post('/edit/:id', isAuthenticated, async (req, res, next) => {
    const { title, content, imageUrl } = req.body;
    const postId = req.params.id;
    let errors = [];

    if (!title || !content) {
        errors.push({ msg: 'Please fill in title and content.' });
    }

    if (errors.length > 0) {
        let postForTemplate = { _id: postId, title, content, imageUrl }; 
        try {
            const originalPost = await Post.findById(postId).lean();
            if (originalPost) {
                postForTemplate = { ...originalPost, title, content, imageUrl }; 
            }
        } catch(e) {
            
        }
        return res.render('edit-post', {
            title: 'Edit Post: ' + (postForTemplate.title || 'Error'),
            errors,
            post: postForTemplate,
            path: req.path 
        });
    }

    try {
        const post = await Post.findById(postId);
        if (!post) {
            req.flash('error_msg', 'Post not found.');
            return res.redirect('/posts/my-posts');
        }
        if (post.author.toString() !== req.user._id.toString()) {
            req.flash('error_msg', 'Not authorized to update this post.');
            return res.redirect('/posts/my-posts');
        }

        post.title = title;
        post.content = content;
        post.imageUrl = imageUrl;
        await post.save();

        req.flash('success_msg', 'Post updated successfully!');
        res.redirect(`/posts/${postId}`);
    } catch (err) {
        console.error('Error updating post:', err);
        let postForTemplate = { _id: postId, title, content, imageUrl };
        try {
            const originalPost = await Post.findById(postId).lean();
            if (originalPost) {
                postForTemplate = { ...originalPost, title, content, imageUrl };
            }
        } catch(e) {
            // Ignore
        }
        res.render('edit-post', {
            title: 'Edit Post: ' + (postForTemplate.title || 'Error'),
            errors: [{ msg: 'Could not update post. Please try again.' }],
            post: postForTemplate,
            path: req.path
        });
    }
});

router.post('/delete/:id', isAuthenticated, async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            req.flash('error_msg', 'Post not found.');
            return res.redirect('/posts/my-posts');
        }
        if (post.author.toString() !== req.user._id.toString()) {
            req.flash('error_msg', 'Not authorized to delete this post.');
            return res.redirect('/posts/my-posts');
        }

        await Post.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Post deleted successfully.');
        res.redirect('/posts/my-posts');
    } catch (err) {
        console.error('Error deleting post:', err);
        req.flash('error_msg', 'Error deleting post.');
        res.redirect('/posts/my-posts');
    }
});

module.exports = router;