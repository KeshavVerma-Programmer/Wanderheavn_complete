const mongoose = require('mongoose');
const Admin = require("../models/admin.js"); 
const dbUrl = "mongodb://localhost:27017/wanderheavn"; 

mongoose.connect(dbUrl)
    .then(() => console.log("MongoDB Connected Successfully!"))
    .catch(err => console.log("MongoDB Connection Error:", err));

const seedAdmin = async () => {
    try {
        const adminExists = await Admin.findOne({ username: "admin" });
        if (adminExists) {
            console.log("Admin already exists. Seeding skipped.");
            return;
        }

        const admin = new Admin({
            username: "admin",
            email: "admin@wanderheavn.com",
            role: "admin"
        });

        await Admin.register(admin, "admin123"); 
        console.log("Admin seeded successfully!");
    } catch (err) {
        console.error("Error seeding admin:", err);
    } finally {
        mongoose.connection.close();
    }
};
seedAdmin();


