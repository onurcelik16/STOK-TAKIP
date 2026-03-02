// Basit veritabanı kontrolü için script
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'app.sqlite');

try {
  const db = new Database(dbPath);
  
  console.log('\n📊 VERİTABANI İSTATİSTİKLERİ\n');
  
  // Kullanıcılar
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
  console.log(`👥 Kullanıcı sayısı: ${users.count}`);
  
  // Ürünler
  const products = db.prepare('SELECT COUNT(*) as count FROM products').get();
  console.log(`📦 Ürün sayısı: ${products.count}`);
  
  // Stok geçmişi
  const history = db.prepare('SELECT COUNT(*) as count FROM stock_history').get();
  console.log(`📈 Stok kontrol kayıtları: ${history.count}`);
  
  console.log('\n✅ Veritabanı çalışıyor!\n');
  
  db.close();
} catch (e) {
  console.error('❌ Veritabanı bulunamadı veya hata var:', e.message);
  console.log('\n💡 Sunucuyu bir kez çalıştırın: npm run dev\n');
}


