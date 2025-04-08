const Joi = require('joi');

module.exports.listingSchema = Joi.object({
   listing: Joi.object({
      title: Joi.string().min(5).max(100).required(),
      description: Joi.string().min(10).max(500).required(),
      location: Joi.string().required(),
      country: Joi.string().required(),
      price: Joi.number().required().min(0),
      images: Joi.array().items(
         Joi.object({
            url: Joi.string().uri().required(),
            filename: Joi.string().required()
         })
      ).min(1).required(),
      status: Joi.string().valid("Active", "Inactive", "Pending").default("Pending"),
      isFeatured: Joi.boolean().default(false),
      category: Joi.string()
         .valid("apartment", "house", "villa", "cabin", "hotel", "bungalow", "hostel", "resort", "camping", "other")
         .insensitive()
         .required(),
      owner: Joi.string().required(), // ✅ Owner should be a string
      checkInTime: Joi.string().required(),
      checkOutTime: Joi.string().required(),
      geometry: Joi.object({
         type: Joi.string().valid("Point").required(),
         coordinates: Joi.array().items(Joi.number()).length(2).required()
      }).optional()
   }).required()
});


module.exports.reviewSchema = Joi.object({
   review: Joi.object({
      comment: Joi.string().trim().required(),
      rating: Joi.number().integer().min(1).max(5).required()
   }).required()
});
