// Install these first:
// npm init -y
// npm install express dns net cors email-validator

const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const cors = require('cors');
const emailValidator = require('email-validator');

const app = express();
app.use(cors());
app.use(express.json());

// --- Utility Functions ---

function isValidEmailSyntax(email) {
    if (!email) {
        console.log("❌ Email missing in syntax check.");
        return false;
    }
    const isValid = emailValidator.validate(email);
    console.log(isValid ? `✅ Syntax valid for email: ${email}` : `❌ Syntax invalid for email: ${email}`);
    return isValid;
}

function extractDomain(email) {
    if (typeof email !== 'string') {
        console.log("❌ Email is not a string.");
        return null;
    }
    email = email.trim();
    const parts = email.split('@');
    if (parts.length !== 2) {
        console.log(`❌ Email splitting failed for: ${email}`);
        return null;
    }
    const domain = parts[1];
    if (!domain) {
        console.log(`❌ Domain extraction failed from email: ${email}`);
        return null;
    }
    console.log(`🔍 Extracted domain: ${domain.toLowerCase()}`);
    return domain.toLowerCase();
}

async function hasValidMxRecord(domain) {
    try {
        console.log(`🔍 Checking MX record for domain: ${domain}`);
        if (typeof domain !== 'string' || domain.trim() === '') {
            console.log("❌ Invalid domain input.");
            return false;
        }
        const domainRegex = /^(?!-)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*(\.[A-Za-z]{2,})$/;
        if (!domainRegex.test(domain)) {
            console.log(`❌ Domain regex validation failed for: ${domain}`);
            return false;
        }
        const mxRecords = await dns.resolveMx(domain);
        console.log(`📡 MX Records found:`, mxRecords);

        return Array.isArray(mxRecords) && mxRecords.length > 0;
    } catch (error) {
        console.log(`🔥 Error during MX lookup for domain ${domain}:`, error.message);
        return false;
    }
}

async function verifySmtp(email) {
    if (!email || typeof email !== 'string') {
        console.log("❌ Email missing or invalid type in SMTP verification.");
        return false;
    }

    try {
        const domain = extractDomain(email);
        if (!domain) return false;

        const mxRecords = await dns.resolveMx(domain);
        console.log(`📡 SMTP MX records for ${domain}:`, mxRecords);

        if (!Array.isArray(mxRecords) || mxRecords.length === 0) {
            console.log(`❌ No MX records found during SMTP for: ${domain}`);
            return false;
        }

        const sortedMx = mxRecords.sort((a, b) => a.priority - b.priority);
        const ports = [25, 587];

        for (const port of ports) {
            for (const mx of sortedMx) {
                console.log(`⚡ Trying SMTP handshake with ${mx.exchange} on port ${port}`);
                const result = await trySmtpHandshake(mx.exchange, port, email);
                if (result !== null) {
                    console.log(`📩 SMTP handshake result:`, result);
                    return result;
                }
            }
        }

        console.log(`❌ SMTP verification failed for all MX servers of ${domain}`);
        return false;

    } catch (error) {
        console.log(`🔥 Error during SMTP verify for ${email}:`, error.message);
        return false;
    }
}

function trySmtpHandshake(server, port, email) {
    return new Promise((resolve) => {
        let stage = 0;
        let completed = false;

        const socket = net.createConnection(port, server);

        socket.setEncoding('ascii');
        socket.setTimeout(7000);

        socket.on('data', (data) => {
            if (completed) return;

            const code = parseInt(data.substr(0, 3));
            if (isNaN(code)) return;

            if (code === 220 && stage === 0) {
                socket.write(`EHLO example.com\r\n`);
                stage++;
            } else if (code === 250 && stage === 1) {
                socket.write(`MAIL FROM:<check@example.com>\r\n`);
                stage++;
            } else if (code === 250 && stage === 2) {
                socket.write(`RCPT TO:<${email}>\r\n`);
                stage++;
            } else if ((code === 250 || code === 251) && stage === 3) {
                completed = true;
                socket.end('QUIT\r\n');
                console.log(`✅ SMTP server accepted email: ${email}`);
                resolve(true);
            } else if (code >= 500 && code <= 599) {
                completed = true;
                socket.end('QUIT\r\n');
                console.log(`❌ SMTP server rejected email: ${email}`);
                resolve(false);
            }
        });

        socket.on('error', (err) => {
            if (!completed) {
                completed = true;
                socket.destroy();
                console.log(`⚠️ SMTP socket error: ${err.message}`);
                resolve(null);
            }
        });

        socket.on('timeout', () => {
            if (!completed) {
                completed = true;
                socket.destroy();
                console.log(`⚠️ SMTP socket timeout.`);
                resolve(null);
            }
        });

        socket.on('end', () => {
            if (!completed) {
                completed = true;
                resolve(null);
            }
        });
    });
}

function isDisposableEmail(email) {
    const disposableDomains = [
        '10minutemail.com', 'tempmail.com', 'guerrillamail.com', 'mailinator.com'
    ];
    const domain = extractDomain(email);
    const isDisposable = disposableDomains.includes(domain.toLowerCase());
    console.log(isDisposable ? `⚠️ Disposable email domain detected: ${domain}` : `✅ Not disposable domain: ${domain}`);
    return isDisposable;
}

function isBlacklistedEmail(email) {
    const blacklistedEmails = [
        'blocked@example.com'
    ];
    const isBlacklisted = blacklistedEmails.includes(email.toLowerCase());
    console.log(isBlacklisted ? `🚫 Blacklisted email detected: ${email}` : `✅ Not blacklisted email: ${email}`);
    return isBlacklisted;
}

function shouldSkipSmtp(domain) {
    console.log()
    const skipDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com'];
    const skip = skipDomains.includes(domain.toLowerCase());
    console.log(skip ? `ℹ️ SMTP Verification skipped for big provider: ${domain}` : `✅ SMTP Verification will proceed for domain: ${domain}`);
    return skip;
}

// --- API Route ---
app.post('/verify-email', async (req, res) => {
    const { email } = req.body;

    console.log(`📥 Request received to verify email: ${email}`);

    if (!email) {
        console.log('❌ No email provided.');
        return res.status(400).json({ status: false, message: 'Email is required' });
    }

    if (!isValidEmailSyntax(email)) {
        return res.json({ status: false, message: 'Invalid Email Syntax' });
    }

    const domain = extractDomain(email);

    if (!domain) {
        return res.json({ status: false, message: 'Invalid Domain Extracted' });
    }

    if (!await hasValidMxRecord(domain)) {
        return res.json({ status: false, message: 'No MX Record Found' });
    }

    if (isDisposableEmail(email)) {
        return res.json({ status: false, message: 'Disposable Email Detected' });
    }

    if (isBlacklistedEmail(email)) {
        return res.json({ status: false, message: 'Blacklisted Email' });
    }

    let smtpVerified = true;
    if (!shouldSkipSmtp(domain)) {
        smtpVerified = await verifySmtp(email);
    }

    if (!smtpVerified) {
        return res.json({ status: false, message: 'SMTP Verification Failed' });
    }

    return res.json({ status: true, message: 'Valid Email Address' });
});

// --- Start Server ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
