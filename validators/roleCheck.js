const roles = ["admin", "info", "support", "sales"];

module.exports = function isRoleBased(email) {
  const user = email.split("@")[0];
  return roles.includes(user.toLowerCase());
};
