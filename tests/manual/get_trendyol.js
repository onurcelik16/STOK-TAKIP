const Database = require('better-sqlite3');
try {
    const db = new Database('./data/app.sqlite');
    const p = db.prepare("SELECT id, url, store, size, name FROM products WHERE store='trendyol' ORDER BY id DESC LIMIT 5").all();
    console.log(p);
} catch(e) { console.error(e); }
