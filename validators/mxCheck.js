const dns = require("dns").promises;

module.exports = async function hasMx(domain) {
  try {
    const mx = await dns.resolveMx(domain);
    return mx && mx.length > 0;
  } catch {
    return false;
  }
};