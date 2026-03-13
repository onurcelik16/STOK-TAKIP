import axios from 'axios';
import { db } from '../data/db';
import { sendNotificationEmail } from '../utils/email';

type Change = {
  productId: number;
  url: string;
  store: string;
  fromInStock: boolean | null;
  toInStock: boolean;
  price: number | null | undefined;
};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return false;

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    return true;
  } catch (err: any) {
    console.error(`[telegram] Failed to send message to ${chatId}:`, err.message);
    return false;
  }
}

function getUserTelegramId(productId: number): string | null {
  const row = db.prepare(`
    SELECT u.telegram_chat_id 
    FROM users u 
    JOIN products p ON p.user_id = u.id 
    WHERE p.id = ?
  `).get(productId) as { telegram_chat_id: string | null } | undefined;
  return row?.telegram_chat_id || null;
}

function getProductOwnerEmail(productId: number): string | null {
  const row = db.prepare(`
    SELECT u.email FROM users u
    JOIN products p ON p.user_id = u.id
    WHERE p.id = ?
  `).get(productId) as { email: string } | undefined;
  return row?.email || null;
}

export async function notifyChange(change: Change) {
  const statusEmoji = change.toInStock ? '🟢' : '🔴';
  const statusText = change.toInStock ? 'STOKTA' : 'TÜKENDİ';
  const priceText = change.price != null ? `\n💰 Fiyat: ${change.price.toFixed(2)} ₺` : '';

  const text =
    `${statusEmoji} <b>Stok Değişimi</b>\n\n` +
    `🏬 Mağaza: ${change.store.toUpperCase()}\n` +
    `📦 Durum: <b>${statusText}</b>${priceText}\n` +
    `🔗 <a href="${change.url}">Ürüne Git</a>`;

  console.log(`[notify] Stock change: Product #${change.productId} -> ${statusText}`);

  const product = db.prepare('SELECT user_id, name FROM products WHERE id = ?').get(change.productId) as { user_id: number; name: string | null } | undefined;

  // Create in-app notification for product owner
  try {
    if (product) {
      const title = change.toInStock ? 'Ürün Stokta!' : 'Ürün Tükendi';
      const message = `${change.store.toUpperCase()} - ${product.name || change.url.split('/').pop()?.substring(0, 40)}${change.price ? ` (${change.price.toFixed(2)} ₺)` : ''}`;
      db.prepare(
        "INSERT INTO notifications (user_id, type, title, message, product_id) VALUES (?, ?, ?, ?, ?)"
      ).run(product.user_id, change.toInStock ? 'stock_available' : 'stock_unavailable', title, message, change.productId);
    }
  } catch (e: any) {
    console.error('[notify] in-app notification failed:', e.message);
  }

  // Send Telegram notification
  const chatId = getUserTelegramId(change.productId);
  if (chatId) {
    await sendTelegramMessage(chatId, text);
  }

  // Send email notification (uses Brevo when BREVO_API_KEY is set – works for any recipient)
  const ownerEmail = getProductOwnerEmail(change.productId);
  if (ownerEmail) {
    const emailTitle = change.toInStock ? 'Ürün Stokta!' : 'Ürün Tükendi';
    const emailMessage = `${change.store.toUpperCase()} – ${product?.name || change.url.split('/').pop()?.substring(0, 40) || 'Ürün'}${change.price != null ? ` • ${change.price.toFixed(2)} ₺` : ''}`;
    await sendNotificationEmail({
      to: ownerEmail,
      subject: `${emailTitle} – Stock Tracker`,
      title: emailTitle,
      message: emailMessage,
      productUrl: change.url,
      productName: product?.name || undefined,
    });
  }
}

export async function notifyPriceAlert(alert: {
  productId: number;
  url: string;
  store: string;
  targetPrice: number;
  currentPrice: number;
  direction: string;
}) {
  const emoji = alert.direction === 'below' ? '📉' : '📈';
  const dirText = alert.direction === 'below' ? 'altına düştü' : 'üstüne çıktı';

  const text =
    `${emoji} <b>Fiyat Alarmı Tetiklendi!</b>\n\n` +
    `🏬 Mağaza: ${alert.store.toUpperCase()}\n` +
    `🎯 Hedef: ${alert.targetPrice.toFixed(2)} ₺\n` +
    `💰 Güncel: <b>${alert.currentPrice.toFixed(2)} ₺</b>\n` +
    `📊 Fiyat hedef fiyatın ${dirText}!\n` +
    `🔗 <a href="${alert.url}">Ürüne Git</a>`;

  console.log(`[notify] Price alert triggered: Product #${alert.productId} @ ${alert.currentPrice} ₺`);

  // Create in-app notification for product owner
  try {
    const product = db.prepare('SELECT user_id, name FROM products WHERE id = ?').get(alert.productId) as { user_id: number; name: string | null } | undefined;
    if (product) {
      const title = 'Fiyat Alarmı Tetiklendi!';
      const message = `${alert.store.toUpperCase()} - ${product.name || 'Ürün'}: Hedef ${alert.targetPrice.toFixed(2)} ₺ → Güncel ${alert.currentPrice.toFixed(2)} ₺`;
      db.prepare(
        "INSERT INTO notifications (user_id, type, title, message, product_id) VALUES (?, ?, ?, ?, ?)"
      ).run(product.user_id, 'price_alert', title, message, alert.productId);
    }
  } catch (e: any) {
    console.error('[notify] in-app notification failed:', e.message);
  }

  const chatId = getUserTelegramId(alert.productId);
  if (chatId) {
    await sendTelegramMessage(chatId, text);
  }

  // Email notification for price alert
  const product = db.prepare('SELECT user_id, name FROM products WHERE id = ?').get(alert.productId) as { user_id: number; name: string | null } | undefined;
  const ownerEmail = product ? (db.prepare('SELECT email FROM users WHERE id = ?').get(product.user_id) as { email: string } | undefined)?.email : null;
  if (ownerEmail) {
    await sendNotificationEmail({
      to: ownerEmail,
      subject: 'Fiyat alarmı tetiklendi – Stock Tracker',
      title: 'Fiyat Alarmı Tetiklendi!',
      message: `${alert.store.toUpperCase()} – Hedef ${alert.targetPrice.toFixed(2)} ₺, güncel fiyat ${alert.currentPrice.toFixed(2)} ₺.`,
      productUrl: alert.url,
      productName: product?.name || undefined,
    });
  }
}
