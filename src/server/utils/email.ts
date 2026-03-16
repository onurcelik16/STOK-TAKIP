import axios from 'axios';
import { Resend } from 'resend';
import { logger } from './logger';

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_dummy';
const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const fromName = process.env.EMAIL_FROM_NAME || 'Stock Tracker';

const resend = new Resend(RESEND_API_KEY);

// ─── Premium Email Template ─────────────────────────────────────────────

function buildEmailTemplate(options: {
  title: string;
  preheader?: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const { title, preheader, body, ctaText, ctaUrl, footerNote } = options;
  const year = new Date().getFullYear();

  const ctaHtml = ctaText && ctaUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0 8px 0;">
        <tr>
          <td align="center">
            <a href="${ctaUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 36px; border-radius: 12px; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(99,102,241,0.35);">${ctaText}</a>
          </td>
        </tr>
      </table>`
    : '';

  const footerNoteHtml = footerNote
    ? `<p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 16px 0 0 0;">${footerNote}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  ${preheader ? `<meta name="description" content="${preheader}">` : ''}
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #0f172a;">${preheader}</div>` : ''}
  
  <!-- Wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        
        <!-- Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">
          
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #6366f1 0%, #7c3aed 100%); width: 40px; height: 40px; border-radius: 12px; text-align: center; vertical-align: middle; font-size: 20px; box-shadow: 0 4px 12px rgba(99,102,241,0.4);">
                    <span style="color: #ffffff; font-size: 20px; line-height: 40px;">📦</span>
                  </td>
                  <td style="padding-left: 12px;">
                    <span style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Stock</span><span style="color: #818cf8; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Tracker</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #1e293b 0%, #1a2332 100%); border-radius: 20px; border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                
                <!-- Gradient Top Bar -->
                <tr>
                  <td style="height: 4px; background: linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa); border-radius: 20px 20px 0 0; font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 36px 36px 36px;">
                    <!-- Title -->
                    <h1 style="color: #f1f5f9; font-size: 22px; font-weight: 700; margin: 0 0 20px 0; line-height: 1.3; letter-spacing: -0.3px;">${title}</h1>
                    
                    <!-- Body -->
                    <div style="color: #cbd5e1; font-size: 15px; line-height: 1.7;">
                      ${body}
                    </div>
                    
                    <!-- CTA Button -->
                    ${ctaHtml}
                    
                    <!-- Footer Note -->
                    ${footerNoteHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 28px 16px 0 16px;">
              <p style="color: #475569; font-size: 12px; line-height: 1.5; margin: 0;">
                © ${year} Stock Tracker · Stok ve fiyat takip platformu
              </p>
              <p style="color: #334155; font-size: 11px; line-height: 1.5; margin: 8px 0 0 0;">
                Bu e-postayı almak istemiyorsanız <a href="#" style="color: #6366f1; text-decoration: underline;">ayarlarınızdan</a> bildirim tercihlerinizi güncelleyebilirsiniz.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Send Email (Brevo preferred, Resend fallback) ──────────────────────

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

// ─── Panel URL ──────────────────────────────────────────────────────────

function getPanelUrl(): string {
  return process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '';
}

// ─── Email Functions ────────────────────────────────────────────────────

export async function sendWelcomeEmail(email: string, name: string) {
  const panelUrl = getPanelUrl();
  const greeting = name ? `Merhaba ${name}` : 'Merhaba';

  const html = buildEmailTemplate({
    title: `${greeting}, Stock Tracker'a Hoş Geldiniz! 🎉`,
    preheader: 'Hesabınız hazır – ürün takibine hemen başlayın.',
    body: `
      <p style="margin: 0 0 16px 0;">Hesabınız başarıyla oluşturuldu. Artık ürün ekleyip stok ve fiyat takibine başlayabilirsiniz.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
        <tr>
          <td style="padding: 14px 18px; background: rgba(99,102,241,0.08); border-radius: 12px; border-left: 3px solid #6366f1;">
            <p style="color: #a5b4fc; font-size: 13px; font-weight: 600; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px;">Neler Yapabilirsiniz?</p>
            <p style="color: #cbd5e1; font-size: 14px; margin: 0; line-height: 1.6;">
              📦 Ürün ekleyip stok durumunu takip edin<br>
              💰 Fiyat alarmı kurarak fırsatları kaçırmayın<br>
              📱 Telegram botu ile anlık bildirim alın
            </p>
          </td>
        </tr>
      </table>
    `,
    ctaText: 'Panele Git →',
    ctaUrl: panelUrl || '#',
    footerNote: 'Bu e-postayı siz talep etmediyseniz dikkate almayın.',
  });

  return sendEmail({
    to: email,
    subject: `Stock Tracker'a Hoş Geldiniz! 🎉`,
    html,
  });
}

export async function sendVerificationEmail(email: string, code: string) {
  const html = buildEmailTemplate({
    title: 'Hesap Doğrulama Kodu 🔐',
    preheader: `Doğrulama kodunuz: ${code}`,
    body: `
      <p style="margin: 0 0 16px 0;">Kayıt işlemini tamamlamak için aşağıdaki 6 haneli doğrulama kodunu kullanın:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <div style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); padding: 20px 32px; border-radius: 16px; display: inline-block;">
              <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #a5b4fc; font-family: 'Courier New', monospace;">${code}</span>
            </div>
          </td>
        </tr>
      </table>
      <p style="color: #94a3b8; font-size: 13px; margin: 16px 0 0 0; text-align: center;">Bu kod 30 dakika süreyle geçerlidir.</p>
    `,
    footerNote: 'Eğer bu kaydı siz yapmadıysanız lütfen bu e-postayı dikkate almayın.',
  });

  return sendEmail({
    to: email,
    subject: 'Hesap Doğrulama Kodu – Stock Tracker',
    html,
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

  // Determine if stock_available or stock_unavailable or price_alert by title
  const isInStock = title.includes('Stokta');
  const statusEmoji = isInStock ? '🟢' : '🔴';
  const statusColor = isInStock ? '#10b981' : '#ef4444';
  const statusLabel = isInStock ? 'STOKTA' : 'TÜKENDİ';

  const productNameHtml = productName
    ? `<p style="color: #e2e8f0; font-size: 15px; font-weight: 600; margin: 0 0 12px 0;">${productName}</p>`
    : '';

  const html = buildEmailTemplate({
    title: `${statusEmoji} ${title}`,
    preheader: message,
    body: `
      ${productNameHtml}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
        <tr>
          <td style="padding: 16px 18px; background: rgba(255,255,255,0.04); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 4px 0;">
                  <span style="color: #94a3b8; font-size: 13px;">Durum:</span>
                  <span style="color: ${statusColor}; font-size: 13px; font-weight: 700; margin-left: 8px;">● ${statusLabel}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 4px 0;">
                  <span style="color: #94a3b8; font-size: 13px;">Detay:</span>
                  <span style="color: #e2e8f0; font-size: 13px; margin-left: 8px;">${message}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
    ctaText: productUrl ? 'Ürüne Git →' : undefined,
    ctaUrl: productUrl,
    footerNote: 'Bildirim tercihlerinizi ayarlardan yönetebilirsiniz.',
  });

  return sendEmail({ to, subject, html });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const html = buildEmailTemplate({
    title: 'Şifre Sıfırlama Talebi 🔑',
    preheader: 'Şifrenizi sıfırlamak için bağlantıya tıklayın.',
    body: `
      <p style="margin: 0 0 16px 0;">Hesabınız için bir şifre sıfırlama talebi aldık. Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
        <tr>
          <td style="padding: 14px 18px; background: rgba(245,158,11,0.08); border-radius: 12px; border-left: 3px solid #f59e0b;">
            <p style="color: #fbbf24; font-size: 13px; font-weight: 600; margin: 0 0 4px 0;">⏱️ Süre Sınırı</p>
            <p style="color: #cbd5e1; font-size: 13px; margin: 0;">Bu bağlantı <strong>1 saat</strong> süreyle geçerlidir.</p>
          </td>
        </tr>
      </table>
    `,
    ctaText: 'Şifremi Sıfırla →',
    ctaUrl: resetUrl,
    footerNote: 'Bu talebi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz. Şifreniz değişmeyecektir.',
  });

  return sendEmail({
    to: email,
    subject: 'Şifre Sıfırlama – Stock Tracker',
    html,
  });
}
