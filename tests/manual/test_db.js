const Database = require('better-sqlite3');
const db = new Database('./data/app.sqlite');
const products = db.prepare("SELECT id, url, store, size, name FROM products WHERE size IS NOT NULL LIMIT 20").all();
console.log(JSON.stringify(products, null, 2));
