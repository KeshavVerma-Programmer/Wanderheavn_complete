// const mongoose = require("mongoose");
// const Admin = require("../models/admin");

// mongoose.connect("mongodb://127.0.0.1:27017/wanderheavn");

// const seedAdmin = async () => {
//     const admin = new Admin({ username: "admin" });
//     await Admin.register(admin, "admin123"); // Password: admin123
//     console.log("Admin created successfully!");
//     mongoose.connection.close();
// };

// seedAdmin();


const mongoose = require('mongoose');
const Admin = require("../models/admin.js"); // Assuming Admin model is defined
const dbUrl = "mongodb://localhost:27017/wanderheavn"; // Replace with your DB URL

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

        await Admin.register(admin, "admin123"); // Use `passport-local-mongoose` for hashing
        console.log("Admin seeded successfully!");
    } catch (err) {
        console.error("Error seeding admin:", err);
    } finally {
        mongoose.connection.close();
    }
};

seedAdmin();


