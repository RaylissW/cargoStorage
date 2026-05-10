import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_DIR = path.join(__dirname, '../python');
const PYTHON_SCRIPT = path.join(PYTHON_DIR, 'forecast_inference.py');
const ORDERS_CSV = path.join(PYTHON_DIR, 'orders.csv');
const ARTIFACTS_DIR = path.join(PYTHON_DIR, 'artifacts');

router.get('/:sku', (req, res) => {
    const { sku } = req.params;

    const pythonProcess = spawn('python', [
        PYTHON_SCRIPT,
        sku,
        ORDERS_CSV,
        ARTIFACTS_DIR
    ], {
        cwd: PYTHON_DIR,
        encoding: 'utf8'          // ← исправление кодировки
    });

    let outputData = '';

    pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            return res.status(500).json({ error: 'Ошибка выполнения прогноза' });
        }

        try {
            const result = JSON.parse(outputData.trim());
            console.log(`✅ Прогноз успешно получен для SKU ${sku}`);
            res.json(result);                    // теперь с нормальными русскими буквами
        } catch (e) {
            res.status(500).json({ error: 'Ошибка парсинга ответа модели' });
        }
    });
});

export default router;