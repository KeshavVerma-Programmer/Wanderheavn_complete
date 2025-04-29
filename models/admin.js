const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true }, 
    role: { 
        type: String, 
        enum: ["admin"], 
        default: "admin" 
    }
}, { timestamps: true }); 

adminSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("Admin", adminSchema);
