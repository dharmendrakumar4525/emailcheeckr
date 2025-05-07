
// --- server.js ---
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const isValidSyntax = require("./validators/syntax");
const hasMx = require("./validators/mxCheck");
const smtpCheck = require("./validators/smtpCheck");
const isDisposable = require("./validators/disposableCheck");
const isRoleBased = require("./validators/roleCheck");
const extractDomain = require("./utils/domain");

const app = express();
const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), async (req, res) => {
    const inputPath = req.file.path;
    const outputPath = `results/result-${Date.now()}.csv`;
    fs.mkdirSync("results", { recursive: true });
  
    const emails = [];
  
    // Step 1: Collect all rows first
    fs.createReadStream(inputPath)
      .pipe(csv())
      .on("data", (row) => {
        if (row.email) emails.push(row.email.trim());
      })
      .on("end", async () => {
        const results = [];
  
        for (const email of emails) {
          console.log("📧 Checking:", email);
          const domain = extractDomain(email);
          const syntax = isValidSyntax(email);
          const mx = domain ? await hasMx(domain) : false;
          const smtp = domain ? await smtpCheck(domain, 25, email) : null;
          const disposable = isDisposable(email);
          const role = isRoleBased(email);
  
          const status = !syntax || !mx
            ? "invalid"
            : smtp === true
            ? "valid"
            : smtp === false
            ? "invalid"
            : "unknown";
  
          results.push({ email, syntax, mx, smtp, disposable, role, status });
        }
  
        const csvWriter = createCsvWriter({
          path: outputPath,
          header: [
            { id: "email", title: "Email" },
            { id: "syntax", title: "Syntax" },
            { id: "mx", title: "MX" },
            { id: "smtp", title: "SMTP" },
            { id: "disposable", title: "Disposable" },
            { id: "role", title: "RoleBased" },
            { id: "status", title: "FinalStatus" }
          ]
        });
  
        await csvWriter.writeRecords(results);
        res.json({ success: true, message: "Validation complete", file: outputPath });
      });
  });
  

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});