const emailValidator = require("email-validator");
module.exports = function isValidSyntax(email) {
    return emailValidator.validate(email);
  };