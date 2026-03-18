const Database = require('better-sqlite3');
try {
    const db = new Database('./data/app.sqlite');
    const p = db.prepare('SELECT id, url, store, size, name FROM products WHERE id=21').get();
    console.log(p);
} catch(e) { console.error(e); }
