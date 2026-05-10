/// server/db/init.js
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
    console.log('🌱 Заполнение тестовыми данными...');

    db.serialize(() => {

        // 1. Склад
        db.run(`INSERT OR IGNORE INTO warehouse (name) VALUES ('Склад 1')`, function(err) {
            if (err) { console.error('Ошибка склада:', err.message); return; }
            const warehouseId = this.lastID || 1;

            // 2. Стеллаж
            db.run(`INSERT OR IGNORE INTO rack (warehouse_id, name, floors) VALUES (?, ?, ?)`,
                [warehouseId, 'Стеллаж A', 3], function(err) {
                    if (err) { console.error('Ошибка стеллажа:', err.message); return; }
                    const rackId = this.lastID || 1;

                    // 3. Этажи + ячейки (последовательно)
                    let shelvesDone = 0;
                    for (let level = 1; level <= 3; level++) {
                        db.run(`INSERT OR IGNORE INTO shelf (rack_id, level) VALUES (?, ?)`,
                            [rackId, level], function(err) {
                                if (err) return;
                                const shelfId = this.lastID;

                                for (let cell = 1; cell <= 3; cell++) {
                                    db.run(`INSERT OR IGNORE INTO bin 
                    (shelf_id, cell_number, width, height, depth, max_volume, current_volume)
                    VALUES (?, ?, 50.0, 50.0, 50.0, 125000.0, 0.0)`, [shelfId, cell]);
                                }

                                shelvesDone++;
                                if (shelvesDone === 3) insertCargoAndRelations();
                            });
                    }
                });
        });

        function insertCargoAndRelations() {
            // Грузы
            db.run(`INSERT OR IGNORE INTO cargo (name, width, height, depth, volume, weight_per_unit)
              VALUES ('держатели для наушников', 15.0, 10.0, 5.0, 750.0, 0.2)`, function(err) {
                if (err) { console.error('Ошибка груза:', err.message); return; }
                const cargoId = this.lastID || 1;

                // Характеристики груза
                db.run(`INSERT OR IGNORE INTO product_characteristics 
                (cargo_id, temp_min, temp_max, humidity_min, humidity_max, compatibility_group, is_hazardous, is_fragile)
                VALUES (?, 5, 35, 30, 70, 'electronics', FALSE, TRUE)`, [cargoId]);

                // Привязка к первой ячейке (bin_id = 1)
                db.run(`INSERT OR IGNORE INTO bin_cargo (bin_id, cargo_id, quantity, removal_date)
                VALUES (1, ?, 100, NULL)`, [cargoId]);

                console.log(`✅ Добавлен груз "Держатели для наушников" и привязан`);
            });

            // Зона
            db.run(`INSERT OR IGNORE INTO zone (name, warehouse_id, description, default_temp_min, default_temp_max, default_humidity_min, default_humidity_max)
              VALUES ('Зона электроники', 1, 'Хранение аксессуаров и гаджетов', 10, 30, 40, 60)`);

            // Сенсор
            db.run(`INSERT OR IGNORE INTO sensor (bin_id, sensor_type, mqtt_topic) VALUES (1, 'multi', 'warehouse/zone1/sensor1')`, function(err) {
                if (err) return;
                const sensorId = this.lastID || 1;

                for (let i = 1; i <= 3; i++) {
                    db.run(`INSERT OR IGNORE INTO sensor_reading 
                  (sensor_id, timestamp, temperature, humidity, pressure)
                  VALUES (?, datetime('now', '-${i} hour'), ?, ?, ?)`,
                        [sensorId, 22.5 + i, 55 + i * 2, 1013 - i * 2]);
                }
                console.log('✅ Добавлен сенсор и 3 показания');
            });

            console.log('🎉 Тестовые данные успешно добавлены во все таблицы!');
        }
    });
};

export { db, initDb, seedDb };