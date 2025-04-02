// class ExpressError extends Error{
//   constructor(statusCode,message){
//     super();
//     this.statusCode=statusCode;
//     this.message=message;
//   }
// }
// module.exports=ExpressError;


class ExpressError extends Error {
  constructor(statusCode = 500, message = "Something went wrong") {
      super(message); // Pass message to Error constructor
      this.statusCode = statusCode;

      // Captures the correct stack trace
      Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ExpressError;
