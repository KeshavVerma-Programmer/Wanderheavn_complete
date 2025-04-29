const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
    comment: {
        type: String,
        required: true,                
        trim: true,                   
        minlength: [5, "Comment should be at least 5 characters long."]
    },
    rating: {
        type: Number,
        required: true,               
        min: 1,
        max: 5
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true                
    }
}, { timestamps: true });              

module.exports = mongoose.model("Review", reviewSchema);
