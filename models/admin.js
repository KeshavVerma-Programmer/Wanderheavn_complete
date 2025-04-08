const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true }, // Added email
    role: { 
        type: String, 
        enum: ["admin"], 
        default: "admin" // Enforces admin role
    }
}, { timestamps: true }); // Added timestamps

adminSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("Admin", adminSchema);
