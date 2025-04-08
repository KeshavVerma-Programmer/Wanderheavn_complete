const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Environment variable check
if (!process.env.CLOUD_NAME || !process.env.CLOUD_API_KEY || !process.env.CLOUD_API_SECRET) {
    console.error("Cloudinary environment variables are missing. Please check your .env file.");
    process.exit(1); // Stop the app if Cloudinary config is missing
}

// Cloudinary Configuration with Error Handling
try {
    cloudinary.config({
        cloud_name: process.env.CLOUD_NAME,
        api_key: process.env.CLOUD_API_KEY,
        api_secret: process.env.CLOUD_API_SECRET
    });
    console.log("✅ Cloudinary configured successfully");
} catch (error) {
    console.error("❌ Cloudinary configuration error:", error);
}

// Cloudinary Storage Configuration
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'wanderheavn_DEV',
        resource_type: "auto", // Auto-detects file type (image/video)
        allowedFormats: ["png", "jpg", "jpeg"]
    }
});

module.exports = { cloudinary, storage };
