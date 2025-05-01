const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");
const bcrypt = require("bcrypt");

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        minlength: [5, "Username must be at least 5 characters."]
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/.+\@.+\..+/, "Invalid email format."]
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        minlength: [10, "Phone number must be at least 10 digits."]
    },
    role: {
        type: String,
        enum: ["user", "host", "admin"],
        default: "user"
    },
    otp: {
        type: String, 
    },
    otpExpires: {
        type: Date, 
    }
}, { timestamps: true });

userSchema.plugin(passportLocalMongoose, {
    passwordValidator: function(password, cb) {
        if (password.length < 6) {
            return cb("Password must be at least 6 characters long.");
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return cb("Password must contain at least one special character (!@#$%^&* etc).");
        }
        return cb();
    }
});

module.exports = mongoose.model("User", userSchema);