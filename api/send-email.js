/* ==========================================================================
   api/send-email.js
   Vercel serverless function. Receives trade details + a recipient email
   from the form in index.html, fills them into the HTML email template,
   and sends it through your own Gmail account via Nodemailer/SMTP.

   WHY THIS RUNS ON THE SERVER, NOT IN THE BROWSER:
   process.env.GMAIL_APP_PASSWORD is only ever read here, server-side. If
   this were used directly from index.html's JavaScript instead, anyone
   could open devtools and steal it, then send email as you indefinitely.
   Set GMAIL_USER and GMAIL_APP_PASSWORD in Vercel's Environment Variables
   dashboard — never hardcode them in this file.

   GETTING A GMAIL APP PASSWORD:
   1. Turn on 2-Step Verification on the Google account you want to send
      from (Google Account -> Security -> 2-Step Verification).
   2. Google Account -> Security -> App Passwords -> create one (name it
      anything, e.g. "Interlink Sender") -> copy the 16-character password.
   3. That's GMAIL_APP_PASSWORD. GMAIL_USER is just the full Gmail address.
   ========================================================================== */

import nodemailer from 'nodemailer';

/** Basic HTML-escaping so form input can't break the email's markup. */
function escapeHtml(value) {
  if (!value) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Builds a plain-text fallback version - spam filters trust emails more
 *  when they have both HTML and text parts, not HTML-only. */
function buildEmailText(fields) {
  const {
    transactionId, sellerName, buyerName, amount, currency,
    paymentMethod, quantity, asset, verifyLink,
  } = fields;

  return `Dear ${sellerName || 'Seller'},

A buyer has requested to purchase crypto from you on Interlink P2P. Your funds are already protected in escrow — the trade won't complete until you review the details below and confirm you're ready to proceed.

Review and confirm this trade: ${verifyLink || '(link not provided)'}

Transaction Details
--------------------
Transaction ID: ${transactionId}
Buyer: ${buyerName || 'N/A'}
Amount Expected: ${amount} ${currency || 'USD'}
Payment Method: ${paymentMethod || 'N/A'}
Crypto to Release: ${quantity || ''} ${asset || ''}

What happens next:
1. Open the link above to review the full trade details.
2. Verify your wallet to confirm you hold the funds and are ready to proceed.
3. The buyer sends payment through the method listed above.
4. Once you confirm payment is received, release the escrow to complete the trade.

Security: Interlink P2P never asks for your passphrase by email, chat, or phone — only through the secure link above when you choose to verify a trade.

This link is unique to this transaction — don't share it with anyone else. If you don't recognize this trade request, you can safely ignore this email.

Thanks for trading with Interlink.
© 2026 Interlink Network`;
}

/** Builds the full email HTML, substituting real values into the template. */
function buildEmailHtml(fields) {
  const {
    transactionId, sellerName, buyerName, amount, currency,
    paymentMethod, quantity, asset, verifyLink,
  } = fields;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Pending Trade — Confirmation Required</title>
    <meta name="viewport" content="width=device-width,initial-scale=1.0;">
    <style>* { margin: 0; padding: 0; box-sizing: border-box; }</style>
</head>
<body>
<div style="width: 100%;height: 100%;background: #EEEEF2" id="header-container">
    <div style="margin: 0 auto;max-width: 600px;box-sizing: border-box;background: #ffffff;">
        <div style="box-sizing: border-box; font-family: Inter,Helvetica,sans-serif; font-size: 14px;">

            <div style="min-height: 65px;width: 100%;">
                <table cellspacing="0" cellpadding="0" border="0" width="100%" style="min-height: 65px;">
                    <tbody>
                    <tr>
                        <td style="text-align: center;font-size: 0;background: #6F69F1;background-image: linear-gradient(180deg, #6F69F1 0%, #837DFF 100%);padding: 26px 30px;">
                            <span style="font-family: Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                                Interlink<span style="font-weight: 400; opacity: 0.85;">Network</span>
                            </span>
                        </td>
                    </tr>
                    </tbody>
                </table>
            </div>

            <table cellspacing="0" cellpadding="0" border="0" width="100%">
                <tbody>
                <tr>
                    <td style="background: #FFF8EC;border-bottom: 1px solid #FFE4B5;padding: 10px 30px;text-align: center;">
                        <span style="font-family: 'Courier New', monospace; font-size: 12px; font-weight: 700; color: #B8790A; letter-spacing: 0.03em;">
                            Action needed on this trade
                        </span>
                    </td>
                </tr>
                </tbody>
            </table>

            <div style="padding: 24px 6%;width: 100%;box-sizing: border-box">
                <div style="padding: 0 4%; width: 100%; box-sizing: border-box">

                    <p style="margin-bottom: 24px; font-family: 'system-ui'; font-size: 14px; line-height: 20px; color: #1A1A1A; font-weight: 600;">
                        Dear ${escapeHtml(sellerName) || 'Seller'},
                    </p>

                    <div style="font-family: 'system-ui'; font-size: 14px; line-height: 20px; text-align: start; color: #1A1A1A;">
                        <p>
                            A buyer has requested to purchase crypto from you on Interlink P2P. Your funds are already
                            protected with us in our escrow — the trade won't complete until you review the details below and
                            confirm you're ready to proceed.
                        </p>

                        <p style="margin-top: 28px; font-weight: 700; text-align: center">
                            <a style="padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: 600; line-height: 20px; text-align: center; background: #6F69F1; color: #fff; text-decoration: none; display: inline-block;"
                               href="${escapeHtml(verifyLink) || '#'}">
                                Review &amp; Confirm Trade Here
                            </a>
                        </p>

                        <p style="margin-top: 32px; font-family: 'system-ui'; font-size: 14px; line-height: 20px; color: #1A1A1A; font-weight: 600;">
                            Transaction Details
                        </p>

                        <table cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 15px;border: 1px solid #E4E1FB;border-radius: 8px;overflow: hidden;">
                            <tbody>
                            <tr>
                                <td style="padding: 12px 16px;background: #F8F7FE;color: #6B6B6B;font-size: 13px;border-bottom: 1px solid #E4E1FB;">Transaction ID</td>
                                <td style="padding: 12px 16px;background: #F8F7FE;color: #1A1A1A;font-size: 13px;font-weight: 600;text-align: right;border-bottom: 1px solid #E4E1FB;font-family: 'Courier New', monospace;">${escapeHtml(transactionId)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 16px;color: #6B6B6B;font-size: 13px;border-bottom: 1px solid #E4E1FB;">Buyer</td>
                                <td style="padding: 12px 16px;color: #1A1A1A;font-size: 13px;font-weight: 600;text-align: right;border-bottom: 1px solid #E4E1FB;">${escapeHtml(buyerName)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 16px;background: #F8F7FE;color: #6B6B6B;font-size: 13px;border-bottom: 1px solid #E4E1FB;">Amount Expected</td>
                                <td style="padding: 12px 16px;background: #F8F7FE;color: #1A1A1A;font-size: 13px;font-weight: 600;text-align: right;border-bottom: 1px solid #E4E1FB;">${escapeHtml(amount)} ${escapeHtml(currency)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 16px;color: #6B6B6B;font-size: 13px;border-bottom: 1px solid #E4E1FB;">Payment Method</td>
                                <td style="padding: 12px 16px;color: #1A1A1A;font-size: 13px;font-weight: 600;text-align: right;border-bottom: 1px solid #E4E1FB;">${escapeHtml(paymentMethod)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 16px;background: #F8F7FE;color: #6B6B6B;font-size: 13px;">Crypto to Release</td>
                                <td style="padding: 12px 16px;background: #F8F7FE;color: #1A1A1A;font-size: 13px;font-weight: 600;text-align: right;">${escapeHtml(quantity)} ${escapeHtml(asset)}</td>
                            </tr>
                            </tbody>
                        </table>

                        <p style="margin-top: 32px; font-family: 'system-ui'; font-size: 14px; line-height: 20px; color: #1A1A1A; font-weight: 600;">
                            What happens next
                        </p>
                        <p style="margin-top: 15px;">1. Tap the button above to review the full trade details.</p>
                        <p style="margin-top: 8px;">2. Verify your wallet to confirm you hold the funds and are ready to proceed.</p>
                        <p style="margin-top: 8px;">3. The buyer sends payment through the method listed above.</p>
                        <p style="margin-top: 8px;">4. Once you confirm payment is received, release the escrow to complete the trade.</p>

                        <table cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 28px;background: #FFF8EC;border: 1px solid #FFE4B5;border-radius: 8px;">
                            <tbody>
                            <tr>
                                <td style="padding: 14px 16px;color: #8A5A00;font-size: 12px;line-height: 18px;">
                                    <strong>For your safety:</strong> Interlink P2P never asks for your passphrase by email,
                                    chat, or phone — you'll only ever enter it through the secure link above, and only when
                                    you choose to verify a trade yourself.
                                </td>
                            </tr>
                            </tbody>
                        </table>

                        <p style="margin-top: 32px;">Notes:</p>
                        <p style="margin-top: 15px;">• This link is unique to this transaction — don't share it with anyone else.</p>
                        <p style="margin-top: 8px;">• If you don't recognize this trade request, you can safely ignore this email; nothing will happen without your confirmation.</p>

                        <p style="margin-top: 32px; margin-bottom: 15px">Thanks for trading with Interlink.</p>
                    </div>
                </div>
            </div>

            <div class="footer" style="overflow: hidden;font-size: 12px;color:#9B9B9B;">
                <div style="padding: 24px 30px 32px;background-color: #ffffff;border-top: 1px solid #E4E1FB;">
                    <div class="features" style="text-align:center;line-height: 16px;padding: 8px 0 0;">
                        <p style="margin: 8px 0;">
                            <a style="text-decoration: none;color:#9B9B9B;">Escrow-Protected Trades</a>
                            <span style="padding: 0 6px">|</span>
                            <a style="text-decoration: none;color:#9B9B9B;">Seamless Transaction</a>
                        </p>
                    </div>
                    <div class="join-us" style="text-align: center;padding: 20px 0 8px;line-height: 16px;margin: 0;color:#9B9B9B;">
                        Join Our Community
                    </div>
                    <div class="join-us-community" style="margin: 0 auto 24px;text-align: center;">
                        <a href="https://x.com/" style="display:inline-block;margin:0 10px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#6F69F1;text-decoration:none;">X</a>
                        <a href="https://t.me/s/interlinkID" style="display:inline-block;margin:0 10px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#6F69F1;text-decoration:none;">Telegram</a>
                        <a href="https://www.facebook.com/official.interlinklabs" style="display:inline-block;margin:0 10px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#6F69F1;text-decoration:none;">Facebook</a>
                        <a href="https://discord.com/" style="display:inline-block;margin:0 10px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#6F69F1;text-decoration:none;">Discord</a>
                    </div>
                    <div style="text-align: center;margin: 24px 0 0;line-height: 16px;color:#9B9B9B;">
                        © 2026 Interlink Network. All rights reserved.
                    </div>
                    <div style="text-align: center;margin: 8px 0 0;line-height: 16px;color:#B0B0B0;font-size: 11px;">
                        You're receiving this email because a trade was opened using this address on Interlink P2P.
                    </div>
                </div>
            </div>

        </div>
    </div>
</div>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    transactionId, sellerName, buyerName, amount, currency,
    paymentMethod, quantity, asset, verifyLink, recipientEmail,
  } = req.body || {};

  if (!recipientEmail || !amount || !transactionId) {
    return res.status(400).json({ error: 'Missing required fields: recipientEmail, amount, and transactionId are required.' });
  }

  const html = buildEmailHtml({
    transactionId, sellerName, buyerName, amount, currency,
    paymentMethod, quantity, asset, verifyLink,
  });

  const text = buildEmailText({
    transactionId, sellerName, buyerName, amount, currency,
    paymentMethod, quantity, asset, verifyLink,
  });

  // Gmail SMTP transporter, authenticated with an App Password (not your
  // normal Gmail password - see the setup notes at the top of this file).
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"Interlink P2P" <${process.env.GMAIL_USER}>`,
      to: recipientEmail,
      subject: `Trade ${transactionId} — action needed to proceed`,
      text,
      html,
    });

    return res.status(200).json({ success: true, id: info.messageId });
  } catch (err) {
    // Nodemailer's error messages (bad auth, invalid recipient, etc.) get
    // passed straight through so the form can show something meaningful.
    return res.status(500).json({ error: err.message });
  }
}
