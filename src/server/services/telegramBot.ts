import axios from 'axios';
import { db } from '../data/db';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const POLL_INTERVAL = 5000; // 5 seconds

let lastUpdateId = 0;

export async function startTelegramBot() {
    if (!TELEGRAM_BOT_TOKEN) {
        console.warn('[telegram] No TELEGRAM_BOT_TOKEN found, bot service disabled.');
        return;
    }

    console.log('[telegram] Starting bot polling service...');

    // Start polling loop
    poll();
}

async function poll() {
    try {
        const response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`, {
            params: {
                offset: lastUpdateId + 1,
                timeout: 30,
            },
        });

        if (response.data.ok) {
            const updates = response.data.result;
            for (const update of updates) {
                lastUpdateId = update.update_id;
                await handleUpdate(update);
            }
        }
    } catch (err: any) {
        console.error('[telegram] Polling error:', err.message);
    } finally {
        setTimeout(poll, POLL_INTERVAL);
    }
}

async function handleUpdate(update: any) {
    const message = update.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id.toString();
    const text = message.text.trim();

    // Handle /start command
    if (text.startsWith('/start')) {
        const parts = text.split(' ');
        if (parts.length > 1) {
            const code = parts[1];
            await handleVerifyCode(chatId, code);
        } else {
            await sendReply(chatId, 'Merhaba! Hesabınızı bağlamak için lütfen web panelindeki kodu "/start KOD" şeklinde gönderin.');
        }
    } else if (text === '/status') {
        await handleStatus(chatId);
    } else if (text === '/help') {
        await sendReply(chatId, 'Komutlar:\n/start [kod] - Hesabınızı bağlar\n/status - Bağlantı durumunu gösterir\n/help - Yardım gösterir');
    }
}

async function handleVerifyCode(chatId: string, code: string) {
    try {
        const user = db.prepare('SELECT id, name FROM users WHERE telegram_verify_code = ?').get(code) as { id: number; name: string | null } | undefined;

        if (user) {
            // Update user with chat ID and clear verify code
            db.prepare('UPDATE users SET telegram_chat_id = ?, telegram_verify_code = NULL WHERE id = ?').run(chatId, user.id);

            await sendReply(chatId, `✅ Teşekkürler ${user.name || 'kullanıcı'}! Hesabınız başarıyla bağlandı. Artık stok ve fiyat bildirimlerini buradan alacaksınız.`);
            console.log(`[telegram] User #${user.id} matched with chatId ${chatId}`);
        } else {
            await sendReply(chatId, '❌ Geçersiz veya süresi dolmuş kod. Lütfen web panelinden yeni bir kod alın.');
        }
    } catch (err: any) {
        console.error('[telegram] Verify code error:', err.message);
        await sendReply(chatId, '❌ Bir hata oluştu, lütfen daha sonra tekrar deneyin.');
    }
}

async function handleStatus(chatId: string) {
    const user = db.prepare('SELECT email, name FROM users WHERE telegram_chat_id = ?').get(chatId) as { email: string; name: string | null } | undefined;

    if (user) {
        await sendReply(chatId, `🔔 <b>Durum: Bağlı</b>\n\n👤 Kullanıcı: ${user.name || 'Belirtilmemiş'}\n📧 E-posta: ${user.email}\n\nBildirimler aktif.`);
    } else {
        await sendReply(chatId, '❌ Bu Telegram hesabı herhangi bir kullanıcıya bağlı değil.');
    }
}

async function sendReply(chatId: string, text: string) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
        });
    } catch (err: any) {
        console.error(`[telegram] Failed to send reply to ${chatId}:`, err.message);
    }
}
