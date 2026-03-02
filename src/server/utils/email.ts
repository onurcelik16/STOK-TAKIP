import { Resend } from 'resend';
import { logger } from './logger';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');
const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

export async function sendVerificationEmail(email: string, code: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
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

    if (error) {
      logger.error(`[Email] Error sending to ${email}: ${error.message}`);
      return false;
    }

    logger.info(`[Email] Verification code sent to ${email}`);
    return true;
  } catch (e: any) {
    logger.error(`[Email] Exception: ${e.message}`);
    return false;
  }
}
