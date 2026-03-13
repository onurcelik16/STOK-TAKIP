import axios from 'axios';
import { Resend } from 'resend';
import { logger } from './logger';

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_dummy';
const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const fromName = process.env.EMAIL_FROM_NAME || 'Stock Tracker';

const resend = new Resend(RESEND_API_KEY);

/**
 * Send email to any recipient.
 * - If BREVO_API_KEY is set: uses Brevo (free tier: 300/day to any address).
 * - Else if RESEND_API_KEY is set: uses Resend (free tier often limited to verified/sender address only).
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const { to, subject, html } = options;

  // Prefer Brevo: free plan allows sending to any recipient (300 emails/day)
  if (BREVO_API_KEY && BREVO_API_KEY !== 'dummy') {
    try {
      await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        },
        {
          headers: {
            'api-key': BREVO_API_KEY,
            'content-type': 'application/json',
          },
          timeout: 10000,
        }
      );
      logger.info({ to }, '[Email] Sent via Brevo');
      return true;
    } catch (e: any) {
      logger.error({ err: e?.response?.data || e.message, to }, '[Email] Brevo failed');
      return false;
    }
  }

  // Fallback: Resend (free tier may only send to your own/verified address)
  try {
    const { error } = await resend.emails.send({
      from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
      to,
      subject,
      html,
    });
    if (error) {
      logger.error({ error: error.message, to }, '[Email] Resend error');
      return false;
    }
    logger.info({ to }, '[Email] Sent via Resend');
    return true;
  } catch (e: any) {
    logger.error({ err: e.message, to }, '[Email] Resend exception');
    return false;
  }
}

/** Panel URL for links in emails (e.g. https://stok-takip-six.vercel.app) */
function getPanelUrl(): string {
  return process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '';
}

export async function sendWelcomeEmail(email: string, name: string) {
  const panelUrl = getPanelUrl();
  const linkHtml = panelUrl
    ? `<p style="margin-top: 20px;"><a href="${panelUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Panele Git</a></p>`
    : '<p style="margin-top: 16px; color: #6b7280;">Kayıt olduğunuz panel adresinden giriş yapabilirsiniz.</p>';

  return sendEmail({
    to: email,
    subject: 'Stock Tracker\'a Hoş Geldiniz!',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-bottom: 20px;">Hoş Geldiniz${name ? ` ${name}` : ''}!</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Stock Tracker hesabınız hazır. Ürün ekleyip stok ve fiyat takibine hemen başlayabilirsiniz.</p>
        ${linkHtml}
        <p style="color: #9ca3af; font-size: 14px; margin-top: 24px;">Bu e-postayı siz talep etmediyseniz dikkate almayın.</p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(email: string, code: string) {
  return sendEmail({
    to: email,
    subject: 'Hesap Doğrulama Kodu - Stock Tracker',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-bottom: 20px;">Stock Tracker'a Hoş Geldiniz!</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Kayıt işlemini tamamlamak için aşağıdaki 6 haneli doğrulama kodunu kullanın:</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${code}</span>
        </div>
        <p style="color: #9ca3af; font-size: 14px;">Eğer bu kaydı siz yapmadıysanız lütfen bu e-postayı dikkate almayın.</p>
      </div>
    `,
  });
}

export async function sendNotificationEmail(options: {
  to: string;
  subject: string;
  title: string;
  message: string;
  productUrl?: string;
  productName?: string;
}) {
  const { to, subject, title, message, productUrl, productName } = options;
  const linkHtml = productUrl
    ? `<p style="margin-top: 16px;"><a href="${productUrl}" style="color: #4f46e5;">Ürüne git</a></p>`
    : '';
  const nameLine = productName ? `<p style="color: #6b7280;">Ürün: ${productName}</p>` : '';

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-bottom: 16px;">${title}</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">${message}</p>
        ${nameLine}
        ${linkHtml}
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">Stock Tracker bildirimi</p>
      </div>
    `,
  });
}
