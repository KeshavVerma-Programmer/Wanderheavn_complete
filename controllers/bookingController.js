require('dotenv').config();
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Razorpay = require("razorpay"); 
const Admin = require("../models/admin");
const crypto = require("crypto");
const Host = require("../models/host");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});
module.exports.getBookingPage = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }

    res.render("bookings/book", { listing, currUser: req.user });
};

module.exports.createBooking = async (req, res) => {
    const { id } = req.params;
    const { checkInDate, checkOutDate } = req.body;

    if (!checkInDate || !checkOutDate) {
        req.flash("error", "Please select both check-in and check-out dates.");
        return res.redirect(`/listings/${id}/book`);
    }

    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/listings");
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (checkOut <= checkIn) {
        req.flash("error", "Check-out date must be after check-in date.");
        return res.redirect(`/listings/${id}/book`);
    }

    const selectedDates = [];
    let current = new Date(checkIn);
    const lastNight = new Date(checkOut);
    lastNight.setDate(lastNight.getDate() - 1); 

    while (current <= lastNight) {
        selectedDates.push(new Date(current).toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
    }

const existingBookings = await Booking.find({
    property: listing._id,
    status: { $in: ["Paid", "Pending"] }
});

let allBookedDates = [];
existingBookings.forEach(booking => {
    const formatted = booking.bookedDates.map(date =>
        new Date(date).toISOString().split("T")[0]
    );
    allBookedDates.push(...formatted);
});

const overlap = selectedDates.some(date => allBookedDates.includes(date));
if (overlap) {
    req.flash("error", "One or more of your selected dates have already been booked.");
    return res.redirect(`/listings/${id}/book`);
}
    res.redirect(
        `/listings/${id}/payment?dates=${selectedDates.join(",")}&checkout=${checkOutDate}&listingId=${listing._id}`
    );
};

module.exports.getPaymentPage = async (req, res) => {
    const { id } = req.params;
    const { dates, listingId, checkout } = req.query;

    if (!dates || !listingId || !checkout) {
        req.flash("error", "Invalid booking request.");
        return res.redirect(`/listings/${id}/book`);
    }

    try {
        const listing = await Listing.findById(listingId);
        if (!listing) {
            req.flash("error", "Listing not found.");
            return res.redirect(`/listings/${id}/book`);
        }

        const selectedDates = dates.split(",");
        const checkInDate = selectedDates[0]; 
        const checkOutDate = checkout;

        const totalNights = (new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24);
        const totalPrice = totalNights * listing.price;

        const adminCommission = Math.round(totalPrice * 0.10);

        req.session.bookingDetails = {
            listingId,
            checkInDate,
            checkOutDate,
            selectedDates,
            totalPrice,
            adminCommission
        };

        res.render("bookings/payment", { 
            checkInDate, 
            checkOutDate, 
            totalNights, 
            booking: { 
                property: listing, 
                bookedDates: selectedDates, 
                totalPrice
            } 
        });

    } catch (err) {
        console.error(" Error in getPaymentPage:", err);
        req.flash("error", "Something went wrong.");
        return res.redirect(`/listings/${id}/book`);
    }
};

module.exports.processPayment = async (req, res) => {
    try {
        console.log(" Full Received Request Body:", req.body);

        const listingId = req.params.id;
        const bookingDates = req.body.bookingDates; 
        console.log(" Received bookingDates:", bookingDates, "Listing ID:", listingId);

        if (!bookingDates || !listingId || typeof bookingDates !== "string") {
            console.log("Error: Missing bookingDates or listingId");
            return res.status(400).json({ success: false, message: "Invalid payment request." });
        }

        const listing = await Listing.findById(listingId).populate({ path: "owner", model: "Host" });
        if (!listing) {
            console.log(`Error: Listing not found for ID: ${listingId}`);
            return res.status(404).json({ success: false, message: "Listing not found." });
        }

        if (!listing.price) {
            console.log("Error: Listing price is missing.");
            return res.status(400).json({ success: false, message: "Invalid listing price." });
        }

        const selectedDates = bookingDates.split(",").map(date => date.trim());
        const checkInDate = selectedDates[0];
        const checkOutDate = selectedDates[selectedDates.length]; 

        const totalNights = selectedDates.length;
        if (totalNights < 1) {
            console.log("Error: Invalid booking duration.");
            return res.status(400).json({ success: false, message: "Invalid booking duration." });
        }

        const totalPrice = totalNights * listing.price;

        console.log("🔎 Razorpay Key ID:", process.env.RAZORPAY_KEY_ID);
        console.log("🔎 Razorpay Key Secret:", process.env.RAZORPAY_KEY_SECRET);

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.log("Error: Razorpay API keys missing.");
            return res.status(500).json({ success: false, message: "Payment service unavailable." });
        }

        const orderOptions = {
            amount: totalPrice * 100, 
            currency: "INR",
            receipt: `order_${new Date().getTime()}`,
            payment_capture: 1,
        };

        console.log("🛒 Creating Razorpay Order with options:", orderOptions);

        try {
            const razorpayOrder = await razorpay.orders.create(orderOptions);
            console.log("Razorpay Order Created:", razorpayOrder);

            const commissionRate = 0.10;
            const adminCommission = totalPrice * commissionRate;
            const hostEarnings = totalPrice - adminCommission;

            const newBooking = new Booking({
                property: listingId,
                guest: req.user._id,
                host: listing.owner._id,
                bookedDates: selectedDates,
                totalPrice,
                adminCommission,
                amountPaid: hostEarnings,
                status: "Pending",
                orderId: razorpayOrder.id,
            });

            await newBooking.save();

            return res.json({
                success: true,
                message: "Razorpay order created successfully",
                orderId: razorpayOrder.id,
                amount: totalPrice * 100,
                currency: "INR",
                key: process.env.RAZORPAY_KEY_ID,
                bookingId: newBooking._id,
            });

        } catch (razorpayError) {
            console.error("Razorpay Error:", razorpayError);
            return res.status(500).json({ success: false, message: "Payment processing failed." });
        }

    } catch (err) {
        console.error("Error processing payment:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

module.exports.verifyPayment = async (req, res) => {
    try {
        const { paymentId, orderId, signature } = req.body;

        const booking = await Booking.findOne({ orderId });

        if (!booking) {
            console.error(" No booking found for orderId:", orderId);
            return res.status(400).json({ success: false, message: "Invalid booking." });
        }

        console.log("Booking found:", booking._id, "Status:", booking.status);

        if (booking.status !== "Pending") {
            console.warn("⚠️ Booking already processed:", booking.status);
            return res.status(400).json({ success: false, message: "Booking is not in a payable state." });
        }

        const listing = await Listing.findById(booking.property);
        if (!listing) {
            console.error("Listing not found for property ID:", booking.property);
            return res.status(400).json({ success: false, message: "Listing not found." });
        }

        const confirmedBookedDates = booking.bookedDates.slice(0, -1);
        const alreadyBooked = confirmedBookedDates.some(date =>
            listing.bookedDates.some(booked => new Date(booked).getTime() === new Date(date).getTime())
        );

        if (alreadyBooked) {
            console.warn("Duplicate dates found! Deleting booking:", booking._id);
            await Booking.deleteOne({ _id: booking._id });
            return res.status(400).json({ success: false, message: "Dates already booked. Booking deleted." });
        }

        listing.bookedDates = Array.from(new Set([
            ...listing.bookedDates.map(d => new Date(d).toISOString()),
            ...confirmedBookedDates.map(d => new Date(d).toISOString())
        ]));
        await listing.save();

        booking.razorpayPaymentId = paymentId;
        booking.status = "Paid";
        await booking.save();

        console.log(`Booking confirmed and paid: ${booking._id}`);
        return res.json({ success: true, bookingId: booking._id });

    } catch (error) {
        console.error("verifyPayment error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};
const { sendBookingConfirmationEmail } = require('../services/emailService');  

module.exports.getConfirmationPage = async (req, res) => {
  const { bookingId } = req.query;

  if (!bookingId) {
    req.flash("error", "Invalid booking.");
    return res.redirect("/listings");
  }

  const booking = await Booking.findById(bookingId)
    .populate({ path: "host", select: "username email" })
    .populate({ path: "guest", select: "username email" })
    .populate("property");

  if (!booking) {
    req.flash("error", "Booking not found.");
    return res.redirect("/listings");
  }

  console.log(`Booking ${bookingId} details loaded.`);

  try {
    await sendBookingConfirmationEmail(booking.guest.email, booking);
    console.log('Booking confirmation email sent.');
  } catch (error) {
    console.error('Failed to send booking confirmation email:', error);
  }

  res.render("bookings/confirmation", { booking, currUser: req.user });
};