const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
    },
    content: {
        type: String,
        required: [true, 'Content is required'],
    },
    imageUrl: {
        type: String,
        trim: true,
        default: ''
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }
}, { timestamps: true });

postSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) { 
      this.updatedAt = Date.now();
    }
    next();
});

module.exports = mongoose.models.Post || mongoose.model('Post', postSchema);