const disposables = ["10minutemail.com", "yopmail.com", "tempmail.net"];
const extractDomain = require("../utils/domain");

module.exports = function isDisposable(email) {
  const domain = extractDomain(email);
  return disposables.includes(domain);
};