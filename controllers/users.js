const User = require("../models/user");
const passport = require("passport");

module.exports.renderUserSignupForm = (req, res) => {
    res.render("users/signup.ejs");
};

module.exports.userSignup = async (req, res, next) => {
    try {
        const { username, email, password, phone } = req.body;

        // ✅ Username must be at least 5 characters
        if (username.length < 5) {
            req.flash("error", "Username must be at least 5 characters long.");
            return res.redirect("/user/signup");
        }

        // ✅ Password must be at least 6 characters and contain a special character
        if (password.length < 6) {
            req.flash("error", "Password must be at least 6 characters long.");
            return res.redirect("/user/signup");
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            req.flash("error", "Password must contain at least one special character (!@#$%^&* etc).");
            return res.redirect("/user/signup");
        }

        // Create a new User instance
        const user = new User({ username, email, phone });

        // Register user with hashed password
        const registeredUser = await User.register(user, password);

        // Automatically log the user in after signup
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to WanderHeavn!");
            return res.redirect("/listings");
        });

    } catch (error) {
        console.error("User Registration Error:", error);

        // ✅ Handle duplicate key errors (MongoDB error code 11000)
        if (error.code === 11000 && error.keyPattern) {
            if (error.keyPattern.email) {
                req.flash("error", "This email is already registered. Try another one.");
            } else if (error.keyPattern.phone) {
                req.flash("error", "This phone number is already in use. Use a different one.");
            } else if (error.keyPattern.username) {
                req.flash("error", "This username is already taken. Try another.");
            } else {
                req.flash("error", "Duplicate value detected. Please try again.");
            }
        } 
        // ✅ Handle password-related errors from Passport
        else if (error.name === "UserExistsError") {
            req.flash("error", "This username is already taken. Try another.");
        } 
        // ✅ Handle email format errors
        else if (error.errors?.email?.message) {
            req.flash("error", "Invalid email format. Please enter a valid email.");
        }
        // ✅ General error fallback
        else {
            req.flash("error", "Something went wrong. Please check your details and try again.");
        }

        return res.redirect("/user/signup");
    }
};

module.exports.renderUserLoginForm = (req, res) => {
    res.render("users/login.ejs");
};

module.exports.userLogin = (req, res, next) => {
    passport.authenticate("user-local", (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            req.flash("error", info?.message || "Invalid username/email or password.");
            return res.redirect("/user/login");
        }

        req.logIn(user, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome back to WanderHeavn!");
            res.redirect(res.locals.redirectUrl || "/listings");
        });
    })(req, res, next);
};

module.exports.logout = (req, res, next) => {
    req.logOut((err) => {
        if (err) {
            console.error("Logout Error:", err);
            req.flash("error", "Failed to log out. Please try again.");
            return next(err);
        }
        req.flash("success", "You are logged out!");
        res.redirect("/listings");
    });
};