module.exports = function extractDomain(email) {
    if (!email.includes("@")) return null;
    return email.trim().split("@")[1].toLowerCase();
  };