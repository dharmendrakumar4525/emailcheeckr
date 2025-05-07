const net = require("net");

module.exports = function smtpCheck(server, port, email) {
  return new Promise((resolve) => {
    console.log(`🌐 Connecting to SMTP server: ${server}:${port}`);
    const socket = net.createConnection(port, server);
    let stage = 0;
    let completed = false;

    socket.setEncoding("ascii");
    socket.setTimeout(7000);

    socket.on("data", (data) => {
      const code = parseInt(data.substring(0, 3), 10);
      const response = data.trim();
      console.log("📨 SMTP Response:", response);

      if (completed) return;

      switch (stage) {
        case 0:
          if (code === 220) {
            console.log("✅ Connected to SMTP server, sending EHLO...");
            socket.write(`EHLO example.com\r\n`);
            stage++;
          }
          break;

        case 1:
          if (code === 250) {
            console.log("✅ EHLO accepted, sending MAIL FROM...");
            socket.write(`MAIL FROM:<check@example.com>\r\n`);
            stage++;
          }
          break;

        case 2:
          if (code === 250) {
            console.log(`✅ MAIL FROM accepted, checking recipient: ${email}`);
            socket.write(`RCPT TO:<${email}>\r\n`);
            stage++;
          }
          break;

        case 3:
          completed = true;
          socket.end("QUIT\r\n");
          if (code === 250 || code === 251) {
            console.log(`✅ Email address exists: ${email}`);
            resolve({ status: true, message: response });
          } else if (code >= 500) {
            console.log(`❌ Invalid email address: ${email}`);
            resolve({ status: false, message: response });
          } else {
            console.log(`⚠️ Unknown response for ${email}`);
            resolve({ status: null, message: response });
          }
          break;

        default:
          completed = true;
          socket.end("QUIT\r\n");
          console.log(`⚠️ Unexpected stage or response for ${email}`);
          resolve({ status: null, message: response });
          break;
      }
    });

    socket.on("error", (err) => {
      if (!completed) {
        completed = true;
        socket.destroy();
        console.log(`❌ SMTP Error: ${err.message}`);
        resolve({ status: null, error: err.message });
      }
    });

    socket.on("timeout", () => {
      if (!completed) {
        completed = true;
        socket.destroy();
        console.log(`⏰ Timeout: No response for ${email}`);
        resolve({ status: null, error: "timeout" });
      }
    });
  });
};
