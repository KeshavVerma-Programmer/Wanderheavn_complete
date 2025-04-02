// module.exports=(fn)=>{
//     return(req,res,next)=>{
//         fn(req,res,next).catch(next);
//     }
//     }


module.exports = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
        console.error("Async Error:", err); // Logs error details for debugging
        next(err);
    });
};
