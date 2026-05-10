// check-db.js — проверка структуры базы данных
import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Попробуем два возможных места базы (раскомментируй нужное)
const dbPath = join(__dirname, 'warehouse.db');                    // ← чаще всего здесь
// const dbPath = join(__dirname, 'server/db/warehouse.db');      // ← если база в папке server/db

console.log(`🔍 Проверяем базу по пути: ${dbPath}`);

const db = new sqlite3.Database(dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, rows) => {
    if (err) {
        console.error('❌ Ошибка при чтении базы:', err.message);
        db.close();
        return;
    }

    console.log(`\n✅ Найдено таблиц: ${rows.length}`);
    console.log('─'.repeat(50));
    rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.name}`);
    });
    console.log('─'.repeat(50));

    db.close(() => {
        console.log('✅ Проверка завершена');
    });
});