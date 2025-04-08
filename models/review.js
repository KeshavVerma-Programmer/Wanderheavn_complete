const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
    comment: {
        type: String,
        required: true,                // Ensures comment is mandatory
        trim: true,                    // Removes extra spaces
        minlength: [5, "Comment should be at least 5 characters long."]
    },
    rating: {
        type: Number,
        required: true,                // Ensures rating is mandatory
        min: 1,
        max: 5
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true                // Ensures reviews must have an author
    }
}, { timestamps: true });              // Auto adds `createdAt` and `updatedAt`

module.exports = mongoose.model("Review", reviewSchema);
