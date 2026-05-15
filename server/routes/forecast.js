import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/init.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_DIR = path.join(__dirname, '../python');
const PYTHON_SCRIPT = path.join(PYTHON_DIR, 'forecast_inference.py');
const ORDERS_CSV = path.join(PYTHON_DIR, 'orders.csv');
const ARTIFACTS_DIR = path.join(PYTHON_DIR, 'artifacts');

// ====================== СОХРАНЕНИЕ В БД ======================
const saveForecastToDB = (forecasts) => {
    return new Promise((resolve) => {
        let processed = 0;
        db.serialize(() => {
            forecasts.forEach((item) => {
                const sql = `
          INSERT INTO forecast (
            sku, product_name, history_last_date,
            forecast_horizon_days, predicted_units_next_7_days, recommended_zone
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(sku) DO UPDATE SET
            predicted_units_next_7_days = excluded.predicted_units_next_7_days,
            recommended_zone = excluded.recommended_zone,
            last_calculated = CURRENT_TIMESTAMP
        `;

                db.run(sql, [
                    item.sku,
                    item.product_name,
                    item.history_last_date,
                    item.forecast_horizon_days,
                    item.predicted_units_next_7_days,
                    item.recommended_zone
                ], function (err) {
                    processed++;
                    if (err) {
                        console.error(`❌ Ошибка сохранения ${item.sku}:`, err.message);
                    } else {
                        console.log(`✅ Сохранён/обновлён прогноз для "${item.product_name}" (SKU: ${item.sku})`);
                    }
                    if (processed === forecasts.length) {
                        console.log(`🎉 Всего обработано прогнозов: ${forecasts.length}`);
                        resolve();
                    }
                });
            });
        });
    });
};

// ====================== ЭНДПОИНТЫ ======================

// GET /api/forecast — все прогнозы из БД
router.get('/', (req, res) => {
    const sql = `
    SELECT 
      f.id, f.sku, f.product_name, f.predicted_units_next_7_days,
      f.recommended_zone, f.last_calculated,
      c.name AS cargo_name
    FROM forecast f
    LEFT JOIN cargo c ON f.cargo_id = c.id
    ORDER BY f.predicted_units_next_7_days DESC
  `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Ошибка получения прогнозов:', err.message);
            return res.status(500).json({ error: 'Ошибка получения прогнозов' });
        }
        console.log(`📊 Отправлено прогнозов: ${rows.length}`);
        res.json(rows);
    });
});

// GET /api/forecast/all — запуск модели + сохранение
router.get('/all', (req, res) => {
    console.log('🔮 Запрос прогноза ПО ВСЕМ товарам');

    const pythonProcess = spawn('python', [PYTHON_SCRIPT, 'all', ORDERS_CSV, ARTIFACTS_DIR], {
        cwd: PYTHON_DIR,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let outputData = '';

    pythonProcess.stdout.on('data', (data) => { outputData += data.toString('utf8'); });
    pythonProcess.stderr.on('data', (data) => { console.error('Python stderr:', data.toString('utf8')); });

    pythonProcess.on('close', async (code) => {
        if (code !== 0) return res.status(500).json({ error: 'Ошибка выполнения Python' });

        try {
            const results = JSON.parse(outputData.trim());
            await saveForecastToDB(results);
            res.json(results);
        } catch (e) {
            console.error('Ошибка парсинга:', e);
            res.status(500).json({ error: 'Ошибка парсинга ответа модели' });
        }
    });
});

export default router;