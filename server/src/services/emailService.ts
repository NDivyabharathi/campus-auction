export interface MatchEmailListing {
  id: string;
  title: string;
  startingPrice: number;
  category: string;
}

export interface SendMatchEmailInput {
  recipientEmail: string;
  recipientName: string;
  wantKeywords: string;
  maxPrice?: number;
  listings: MatchEmailListing[];
}

/**
 * Modular email service for Campus Auction.
 * Safely evaluates environment variables. If SMTP credentials are not configured,
 * it returns gracefully without interrupting in-app notifications or throwing exceptions.
 */
export async function sendGroupedMatchEmail(
  input: SendMatchEmailInput
): Promise<{ sent: boolean; reason?: string }> {
  const { recipientEmail, recipientName, wantKeywords, maxPrice, listings } = input;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || '"Campus Auction" <alerts@campusauction.kongu.edu>';

  // Check if SMTP is configured
  if (!host || !user || !pass) {
    // Development note: To enable real SMTP delivery, define in server/.env:
    // SMTP_HOST=smtp.gmail.com
    // SMTP_PORT=587
    // SMTP_USER=your-email@kongu.edu
    // SMTP_PASS=your-app-password
    // SMTP_FROM="Campus Auction" <alerts@campusauction.kongu.edu>
    return {
      sent: false,
      reason: 'smtp_not_configured',
    };
  }

  try {
    // Attempt dynamic import if nodemailer is installed
    let nodemailer: any;
    try {
      const pkg = 'nodemailer';
      nodemailer = await (Function('pkg', 'return import(pkg)')(pkg));
    } catch {
      console.warn('[Email Service] Nodemailer package not installed. Skipping SMTP transport.');
      return { sent: false, reason: 'nodemailer_not_installed' };
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const listingsHtml = listings
      .map(
        (l) => `
        <li style="margin-bottom: 12px; padding: 10px; background: #FFFBF5; border: 1px solid #E7E0D8; border-radius: 8px;">
          <strong style="color: #292524; font-size: 14px;">${l.title}</strong><br/>
          <span style="color: #C2410C; font-weight: bold;">Starting Price: ₹${l.startingPrice}</span> &bull; 
          <span style="color: #78716C;">Category: ${l.category}</span><br/>
          <a href="${clientUrl}/auctions/${l.id}" style="display: inline-block; margin-top: 6px; color: #C2410C; text-decoration: none; font-weight: bold;">View Listing &rarr;</a>
        </li>`
      )
      .join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E7E0D8; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #C2410C; margin: 0;">🏛️ Campus Auction</h2>
          <p style="color: #78716C; font-size: 13px; margin: 4px 0 0 0;">Kongu Engineering College</p>
        </div>
        <h3 style="color: #292524;">New items match your saved want!</h3>
        <p style="color: #78716C; font-size: 14px;">
          Hi ${recipientName},<br/>
          We found <strong>${listings.length}</strong> new listing(s) matching your want for 
          <em>"${wantKeywords}"</em> ${maxPrice ? `(Budget: ≤ ₹${maxPrice})` : ''}.
        </p>
        <ul style="list-style: none; padding: 0;">
          ${listingsHtml}
        </ul>
        <div style="margin-top: 24px; text-align: center;">
          <a href="${clientUrl}/my-wants" style="background: #C2410C; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px;">Manage Your Wants</a>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from,
      to: recipientEmail,
      subject: `Campus Auction Alert: ${listings.length} item(s) match "${wantKeywords}"`,
      html: htmlContent,
      text: `Hi ${recipientName}, we found ${listings.length} item(s) matching your want "${wantKeywords}". View them at: ${clientUrl}/my-wants`,
    });

    return { sent: true };
  } catch (error: any) {
    console.error('[Email Service Error]', error);
    return { sent: false, reason: error.message };
  }
}
