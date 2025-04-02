const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
    property: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
        required: true
    },
    guest: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    host: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    bookedDates: { 
        type: [Date], 
        required: true
    },
    totalPrice: {
        type: Number,
        min: 0,
        required: true
    },
    orderId: { 
        type: String, 
        unique: true, 
        sparse: true
    }, 
    razorpayPaymentId: { type: String },  // To store payment ID after success
    status: {
        type: String,
        enum: ["Pending", "Paid", "Cancelled", "Confirmed"], // ✅ Add "Confirmed"
        required: true,
    }
}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);
