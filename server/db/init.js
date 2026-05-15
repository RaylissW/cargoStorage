
import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../warehouse.db');

console.log(`📍 Подключение к базе: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('❌ Ошибка подключения:', err.message);
    else console.log('✅ Подключено к базе данных SQLite');
});

const initDb = () => {
    console.log('🔨 Создание / обновление структуры таблиц...');
    const sqlPath = join(__dirname, '../sql/tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    db.exec(sql, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблиц:', err.message);
        } else {
            console.log('✅ Все таблицы успешно созданы / обновлены');
            seedDb();                     // ← один раз, после создания таблиц
        }
    });
};

const seedDb = () => {
    console.log('🚀 Полное заполнение БД по вашей реальной структуре...');

    db.serialize(() => {

        // 1. Создаём склады и стеллажи
        db.run(`INSERT OR IGNORE INTO warehouse (name) VALUES ('Склад 1 (печатная)')`, function () {
            const sklad1 = this.lastID || 1;

            db.run(`INSERT OR IGNORE INTO rack (warehouse_id, name, floors) VALUES (?, 'Стеллаж 1', 6)`, [sklad1]);
            db.run(`INSERT OR IGNORE INTO rack (warehouse_id, name, floors) VALUES (?, 'Стеллаж 2', 3)`, [sklad1]);
            db.run(`INSERT OR IGNORE INTO rack (warehouse_id, name, floors) VALUES (?, 'Стеллаж 3', 3)`, [sklad1]);
        });

        db.run(`INSERT OR IGNORE INTO warehouse (name) VALUES ('Склад 2 (Мастерская)')`, function () {
            const sklad2 = this.lastID || 2;

            db.run(`INSERT OR IGNORE INTO rack (warehouse_id, name, floors) VALUES (?, 'Стеллаж 1', 6)`, [sklad2]);
            db.run(`INSERT OR IGNORE INTO rack (warehouse_id, name, floors) VALUES (?, 'Стеллаж 2', 5)`, [sklad2]);
            db.run(`INSERT OR IGNORE INTO rack (warehouse_id, name, floors) VALUES (?, 'Стеллаж 3', 6)`, [sklad2]);
            db.run(`INSERT OR IGNORE INTO rack (warehouse_id, name, floors) VALUES (?, 'Стеллаж 4 (радиодетали)', 6)`, [sklad2]);
        });

        const allCargo = [
            // Товары на продажу (из orders.csv)
            { name: 'держатель для наушников на стол', volume: 536, for_sale: true },
            { name: 'брелок скелет майнкрафт', volume: 417, for_sale: true },
            { name: 'держатель для телефона котёнок', volume: 863, for_sale: true },

            // Упаковочные материалы
            { name: 'картонные коробки', volume: 96000, for_sale: false },

            // 3D-принтеры
            { name: '3D принтер', volume: 150000, for_sale: false },

            // Пластик
            { name: 'пластик для 3D-принтера', volume: 36000, for_sale: false },

            // Радиодетали
            { name: 'радиодетали', volume: 3000, for_sale: false },

            // Остальные товары
            { name: 'баллон с газом', volume: 1200, for_sale: false },
            { name: 'магнитные метки', volume: 800, for_sale: false },
            { name: 'бумажные метки', volume: 400, for_sale: false },
            { name: 'высокоточный измерительный прибор', volume: 900, for_sale: false },
            { name: 'ткань декоративная', volume: 1200, for_sale: false },
            { name: 'хрупкие стеклянные элементы', volume: 600, for_sale: false },
            { name: 'термочувствительный пластик', volume: 1500, for_sale: false },
            { name: 'медицинские расходники', volume: 700, for_sale: false }
        ];

        allCargo.forEach(item => {
            db.run(`
                INSERT OR IGNORE INTO cargo (name, width, height, depth, volume, weight_per_unit, for_sale)
                VALUES (?, 30, 30, 40, ?, 1.0, ?)
            `, [item.name, item.volume, item.for_sale ? 1 : 0]);
        });

        // === 4. Заполняем условия хранения (product_characteristics) ===
        const characteristics = [
            { name: 'баллон с газом', temp_min: 5, temp_max: 35, is_hazardous: 1 },
            { name: 'магнитные метки', temp_min: 10, temp_max: 40 },
            { name: 'бумажные метки', temp_min: 15, temp_max: 30, is_fragile: 1 },
            { name: 'высокоточный измерительный прибор', temp_min: 18, temp_max: 28, is_fragile: 1 },
            { name: 'ткань декоративная', temp_min: 18, temp_max: 25, humidity_min: 40, humidity_max: 70 },
            { name: 'хрупкие стеклянные элементы', temp_min: 15, temp_max: 30, is_fragile: 1 },
            { name: 'термочувствительный пластик', temp_min: 8, temp_max: 22, needs_refrigeration: 1 },
            { name: 'медицинские расходники', temp_min: 10, temp_max: 25, needs_refrigeration: 1 }
        ];

        characteristics.forEach(ch => {
            db.run(`
                INSERT OR IGNORE INTO product_characteristics 
                (cargo_id, temp_min, temp_max, humidity_min, humidity_max, is_fragile, needs_refrigeration)
                SELECT id, ?, ?, ?, ?, ?, ?
                FROM cargo WHERE name = ?
            `, [
                ch.temp_min || 15,
                ch.temp_max || 30,
                ch.humidity_min || 30,
                ch.humidity_max || 70,
                ch.is_fragile ? 1 : 0,
                ch.needs_refrigeration ? 1 : 0,
                ch.name
            ]);
        });

        // === 5. ПРИВЯЗКА ТОВАРОВ К ЯЧЕЙКАМ (главное, что было сломано) ===
        // Стеллаж 1, полка 3, этажи 3 и 4 — товары на продажу
        db.run(`
            INSERT OR IGNORE INTO bin_cargo (bin_id, cargo_id, quantity)
            SELECT b.id, c.id, 100
            FROM bin b
            JOIN shelf s ON b.shelf_id = s.id
            JOIN rack r ON s.rack_id = r.id
            JOIN cargo c ON LOWER(c.name) LIKE '%держатель для наушников%'
            WHERE r.name = 'Стеллаж 1' AND s.level IN (3,4) AND b.cell_number <= 3
        `);

        db.run(`
            INSERT OR IGNORE INTO bin_cargo (bin_id, cargo_id, quantity)
            SELECT b.id, c.id, 50
            FROM bin b
            JOIN shelf s ON b.shelf_id = s.id
            JOIN rack r ON s.rack_id = r.id
            JOIN cargo c ON LOWER(c.name) LIKE '%брелок скелет%'
            WHERE r.name = 'Стеллаж 1' AND s.level IN (3,4) AND b.cell_number <= 3
        `);

        // Стеллаж 1, полка 3 и 4, этаж 1 — картонные коробки
        db.run(`
            INSERT OR IGNORE INTO bin_cargo (bin_id, cargo_id, quantity)
            SELECT b.id, c.id, 200
            FROM bin b
            JOIN shelf s ON b.shelf_id = s.id
            JOIN rack r ON s.rack_id = r.id
            JOIN cargo c ON c.name = 'картонные коробки'
            WHERE r.name = 'Стеллаж 1' AND s.level = 1 AND b.cell_number <= 4
        `);

        // Стеллаж 2 и 3 — 3D-принтеры и пластик
        db.run(`
            INSERT OR IGNORE INTO bin_cargo (bin_id, cargo_id, quantity)
            SELECT b.id, c.id, 1
            FROM bin b
            JOIN shelf s ON b.shelf_id = s.id
            JOIN rack r ON s.rack_id = r.id
            JOIN cargo c ON c.name = '3D принтер'
            WHERE r.name IN ('Стеллаж 2', 'Стеллаж 3') 
              AND ((s.level = 2 AND b.cell_number IN (1,2,4)) OR (s.level = 3 AND b.cell_number IN (1,2)))
        `);

        db.run(`
            INSERT OR IGNORE INTO bin_cargo (bin_id, cargo_id, quantity)
            SELECT b.id, c.id, 50
            FROM bin b
            JOIN shelf s ON b.shelf_id = s.id
            JOIN rack r ON s.rack_id = r.id
            JOIN cargo c ON c.name = 'пластик для 3D-принтера'
            WHERE r.name = 'Стеллаж 3' AND s.level = 3 AND b.cell_number IN (1,2)
        `);

        // Стеллаж 4 (Склад 2) — радиодетали
        db.run(`
            INSERT OR IGNORE INTO bin_cargo (bin_id, cargo_id, quantity)
            SELECT b.id, c.id, 300
            FROM bin b
            JOIN shelf s ON b.shelf_id = s.id
            JOIN rack r ON s.rack_id = r.id
            JOIN cargo c ON c.name = 'радиодетали'
            WHERE r.name = 'Стеллаж 4 (радиодетали)'
        `);
        console.log('🎉 Все товары и условия хранения добавлены');
    });
};

export { db, initDb, seedDb };