const { check, validationResult} = require("express-validator/check");

module.exports = {
  validateMeChecks: [
    check("fName").exists().withMessage("This field is required"),
    check("lName").exists().withMessage("This field is required"),
    check("userName").exists().withMessage("This field is required"),
    check("email").isEmail().withMessage("Invalid email"),
    check("password")
      .isLength({ min: 4 })
      .withMessage("Password length should be atleast 4")
      .custom((value, { req, loc, path }) => {
        if (value !== req.body.confirmPassword) {
          return false;
        } else {
          return value;
        }
      })
      .withMessage("Password don't match"),
  ],
  errorFormatter: ({ location, msg, param, value, nestedErrors }) => {
    return {
      type: "Error",
      name: "Signup Failure",
      location: location,
      message: msg,
      param: param,
      value: value,
      nestedErrors: nestedErrors,
    };
  },
};
