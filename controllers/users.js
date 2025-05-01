const User = require("../models/user");
const passport = require("passport");

module.exports.renderUserSignupForm = (req, res) => {
    res.render("users/signup.ejs");
};

module.exports.userSignup = async (req, res, next) => {
    try {
        const { username, email, password, phone } = req.body;

        if (username.length < 5) {
            req.flash("error", "Username must be at least 5 characters long.");
            return res.redirect("/user/signup");
        }

        if (password.length < 6) {
            req.flash("error", "Password must be at least 6 characters long.");
            return res.redirect("/user/signup");
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            req.flash("error", "Password must contain at least one special character (!@#$%^&* etc).");
            return res.redirect("/user/signup");
        }

        const user = new User({ username, email, phone });

        const registeredUser = await User.register(user, password);

        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to WanderHeavn!");
            return res.redirect("/listings");
        });

    } catch (error) {
        console.error("User Registration Error:", error);

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
        else if (error.name === "UserExistsError") {
            req.flash("error", "This username is already taken. Try another.");
        } 
        else if (error.errors?.email?.message) {
            req.flash("error", "Invalid email format. Please enter a valid email.");
        }
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

const crypto = require('crypto');
const SibApiV3Sdk = require('sib-api-v3-sdk'); 

const brevoClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = brevoClient.authentications['api-key'];
apiKey.apiKey = process.env.SIB_API_KEY; 
const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        req.flash('error', 'No account found with that email.');
        return res.redirect('/user/login');
    }

    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; 

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    const sendSmtpEmail = {
        sender: { name: 'WanderHeavn Support', email: 'wanderheavn2025@gmail.com' }, 
        to: [{ email: user.email }],
        subject: 'Password Reset OTP',
        htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
          <div style="background-color: #ff4d4d; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h2>WanderHeavn</h2>
          </div>
          <div style="padding: 20px; color: #333;">
            <h2 style="color: #ff4d4d;">Forgot your password?</h2>
            <p>No worries, use the following OTP to reset your password:</p>
            <h3 style="color: green;">${otp}</h3>
            <p style="color: purple;">This OTP will expire in 10 minutes.</p>
          </div>
          <div style="text-align: center; font-size: 12px; color: gray; padding: 10px 0;">
            © 2025 <span style="color: #ff4d4d;">WanderHeavn</span>. All rights reserved.
          </div>
        </div>
      `,
    };

    await tranEmailApi.sendTransacEmail(sendSmtpEmail);

    req.flash('success', 'OTP sent! Please check your email.');
    res.redirect('/users/verify-otp');
};

module.exports.showVerifyOtpForm = (req, res) => {
    res.render('users/verify-otp'); 
};

module.exports.verifyOtp = async (req, res) => {
    const { otp } = req.body;
    const user = await User.findOne({
        otp,
        otpExpires: { $gt: Date.now() } 
    });

    if (!user) {
        req.flash('error', 'Invalid or expired OTP.');
        return res.redirect('/users/verify-otp');
    }

    res.render('users/reset-password', { userId: user._id }); 
};

module.exports.resetPassword = async (req, res) => {
    const { userId, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        req.flash('error', 'Passwords do not match.');
        return res.redirect('back');
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            req.flash('error', 'User not found.');
            return res.redirect('/user/login');
        }

        const { error } = await User.authenticate()(user.username, password);
        if (!error) {
            req.flash('error', 'Please use a different password than your current one.');
            return res.redirect('back');
        }

        await new Promise((resolve, reject) => {
            user.setPassword(password, (err) => {
                if (err) return reject(err); 
                resolve();
            });
        });

        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        req.flash('success', 'Password successfully updated. Please login.');
        res.redirect('/user/login');

    } catch (err) {
        console.error("Reset Error:", err);
        req.flash('error', err?.message || 'Password length should 6 characters long and a special character'); 
        res.redirect('back');
    }
};