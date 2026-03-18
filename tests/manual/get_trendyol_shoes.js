const Database = require('better-sqlite3');
try {
    const db = new Database('./data/app.sqlite');
    const p = db.prepare("SELECT id, url, store, size, name FROM products WHERE size IN ('37', '38', '37,5', '38,5') ORDER BY id DESC LIMIT 5").all();
    console.log(p);
} catch(e) { console.error(e); }
