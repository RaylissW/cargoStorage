import express from 'express';
import { db } from '../db/init.js';
import qr from 'qr-image';

const router = express.Router();

// Получение содержимого ячейки
router.get('/:id/cargo', (req, res) => {
  const { id } = req.params;
  console.log('Запрос GET /bin/:id/cargo:', { id });
  db.all(`SELECT c.id AS cargo_id, c.name AS cargo_name, bc.quantity,
  w.name AS warehouse_name, r.name AS rack_name, s.level AS shelf_level, b.cell_number
FROM bin b
LEFT JOIN bin_cargo bc ON b.id = bc.bin_id
LEFT JOIN cargo c ON bc.cargo_id = c.id
LEFT JOIN shelf s ON b.shelf_id = s.id
LEFT JOIN rack r ON s.rack_id = r.id
LEFT JOIN warehouse w ON r.warehouse_id = w.id
WHERE b.id = ?`, [id], (err, rows) => {
    if (err) {
      console.error('Ошибка SQL в GET /bin/:id/cargo:', err.message);
      return res.status(500).json({ error: `Ошибка получения данных ячейки: ${err.message}` });
    }
    if (rows.length === 0 || !rows[0].warehouse_name) {
      console.log('Ячейка не найдена:', id);
      return res.status(404).json({ error: 'Ячейка не найдена' });
    }
    const binData = {
      id: parseInt(id),
      location: {
        warehouse: rows[0].warehouse_name,
        rack: rows[0].rack_name,
        shelf: rows[0].shelf_level,
        cell_number: rows[0].cell_number
      },
      cargos: rows.filter(row => row.cargo_id).map(row => ({
        id: row.cargo_id,
        name: row.cargo_name,
        quantity: row.quantity
      }))
    };
    console.log('Содержимое ячейки:', binData);
    res.json(binData);
  });
});

// Генерация QR-кода как изображения
router.get('/:id/qr-image', (req, res) => {
  const { id } = req.params;
  console.log('Запрос GET /bin/:id/qr-image:', { id });
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID должен быть числом' });
  }
  db.all(`SELECT c.id AS cargo_id, c.name AS cargo_name, bc.quantity,
  w.name AS warehouse_name, r.name AS rack_name, s.level AS shelf_level, b.cell_number
FROM bin b
LEFT JOIN bin_cargo bc ON b.id = bc.bin_id
LEFT JOIN cargo c ON bc.cargo_id = c.id
LEFT JOIN shelf s ON b.shelf_id = s.id
LEFT JOIN rack r ON s.rack_id = r.id
LEFT JOIN warehouse w ON r.warehouse_id = w.id
WHERE b.id = ?`, [id], (err, rows) => {
    if (err) {
      console.error('Ошибка SQL в GET /bin/:id/qr-image:', err.message);
      return res.status(500).send('Ошибка сервера');
    }
    if (rows.length === 0 || !rows[0].warehouse_name) {
      console.log('Ячейка не найдена:', id);
      return res.status(404).send('Ячейка не найдена');
    }
    const binInfo = {
      location: `Склад: ${rows[0].warehouse_name}, Стеллаж: ${rows[0].rack_name}, Этаж: ${rows[0].shelf_level}, Ячейка: ${rows[0].cell_number}`,
      cargos: rows.filter(row => row.cargo_id).map(row => ({
        name: row.cargo_name,
        quantity: row.quantity
      }))
    };
    const qrData = `http://localhost:3000/api/bin/${id}/qr`;
  const qrImage = qr.image(qrData, { type: 'png' });
res.setHeader('Content-Type', 'image/png');
qrImage.pipe(res);
});
});

// HTML-страница для QR-кода ячейки
router.get('/:id/qr', (req, res) => {
  const { id } = req.params;
  console.log('Запрос GET /bin/:id/qr:', { id });
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID должен быть числом' });
  }
  db.all(`SELECT c.id AS cargo_id, c.name AS cargo_name, bc.quantity,
          w.name AS warehouse_name, r.name AS rack_name, s.level AS shelf_level, b.cell_number
          FROM bin b
          LEFT JOIN bin_cargo bc ON b.id = bc.bin_id
          LEFT JOIN cargo c ON bc.cargo_id = c.id
          LEFT JOIN shelf s ON b.shelf_id = s.id
          LEFT JOIN rack r ON s.rack_id = r.id
          LEFT JOIN warehouse w ON r.warehouse_id = w.id
          WHERE b.id = ?`, [id], (err, rows) => {
    if (err) {
      console.error('Ошибка SQL в GET /bin/:id/qr:', err.message);
      return res.status(500).send('Ошибка сервера');
    }
    if (rows.length === 0 || !rows[0].warehouse_name) {
      console.log('Ячейка не найдена:', id);
      return res.status(404).send('Ячейка не найдена');
    }
    const binInfo = {
      location: `Склад: ${rows[0].warehouse_name}, Стеллаж: ${rows[0].rack_name}, Этаж: ${rows[0].shelf_level}, Ячейка: ${rows[0].cell_number}`,
      cargos: rows.filter(row => row.cargo_id).map(row => ({
        name: row.cargo_name,
        quantity: row.quantity
      }))
    };
    const html = `
<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Содержимое ячейки</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
      h1 { font-size: 1.5em; }
      ul { list-style: none; padding: 0; }
      li { margin-bottom: 10px; }
    </style>
  </head>
  <body>
    <h1>Ячейка: ${binInfo.location}</h1>
    ${binInfo.cargos.length > 0 ? `
      <h2>Содержимое:</h2>
      <ul>
        ${binInfo.cargos.map(cargo => `<li>${cargo.name} (Количество: ${cargo.quantity})</li>`).join('')}
      </ul>
    ` : '<p>Нет грузов</p>'}
  </body>
</html>
`;
    console.log('Отправлена HTML-страница для ячейки:', id);
    res.send(html);
  });
});

// Получение полной структуры хранилища
router.get('/structure', (req, res) => {
  console.log('Запрос GET /structure');
  db.all(`SELECT w.id AS w_id, w.name AS w_name,
          r.id AS r_id, r.name AS r_name, r.floors,
          s.id AS s_id, s.level,
          b.id AS b_id, b.cell_number, b.width, b.height, b.depth, b.max_volume,
          c.id AS c_id, c.name AS c_name, c.width AS c_width, c.height AS c_height, c.depth AS c_depth, c.volume AS c_volume,
          bc.quantity
          FROM warehouse w
          LEFT JOIN rack r ON w.id = r.warehouse_id
          LEFT JOIN shelf s ON r.id = s.rack_id
          LEFT JOIN bin b ON s.id = b.shelf_id
          LEFT JOIN bin_cargo bc ON b.id = bc.bin_id
          LEFT JOIN cargo c ON bc.cargo_id = c.id`, [], (err, rows) => {
    if (err) {
      console.error('Ошибка SQL в GET /structure:', err.message);
      return res.status(500).json({ error: `Ошибка получения структуры: ${err.message}` });
    }
    console.log('Данные структуры:', rows.length, 'строк');
    const structure = [];
    const warehouseMap = new Map();
    rows.forEach(row => {
      if (!warehouseMap.has(row.w_id)) {
        warehouseMap.set(row.w_id, {
          id: row.w_id,
          name: row.w_name,
          racks: []
        });
      }
      const warehouse = warehouseMap.get(row.w_id);
      if (row.r_id && !warehouse.racks.find(r => r.id === row.r_id)) {
        warehouse.racks.push({
          id: row.r_id,
          name: row.r_name,
          floors: row.floors,
          shelves: []
        });
      }
      const rack = warehouse.racks.find(r => r.id === row.r_id);
      if (row.s_id && rack && !rack.shelves.find(s => s.id === row.s_id)) {
        rack.shelves.push({
          id: row.s_id,
          level: row.level,
          bins: []
        });
      }
      const shelf = rack?.shelves.find(s => s.id === row.s_id);
      if (row.b_id && shelf) {
        let bin = shelf.bins.find(b => b.id === row.b_id);
        if (!bin) {
          bin = {
            id: row.b_id,
            cell_number: row.cell_number,
            width: row.width,
            height: row.height,
            depth: row.depth,
            max_volume: row.max_volume,
            cargos: []
          };
          shelf.bins.push(bin);
        }
        if (row.c_id) {
          bin.cargos.push({
            id: row.c_id,
            name: row.c_name,
            width: row.c_width,
            height: row.c_height,
            depth: row.c_depth,
            volume: row.c_volume,
            quantity: row.quantity
          });
        }
      }
    });
    structure.push(...warehouseMap.values());
    console.log('Отправлена структура:', structure);
    res.json(structure);
  });
});

// Привязка груза к ячейке
router.post('/bin_cargo', (req, res) => {
  console.log('Запрос POST /bin_cargo:', req.body);
  const { bin_id, cargo_id, quantity } = req.body;
  if (!bin_id || !cargo_id || !quantity || isNaN(bin_id) || isNaN(cargo_id) || isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Неверные данные: bin_id, cargo_id и quantity (числа) обязательны, quantity > 0' });
  }
  db.run(
    `INSERT INTO bin_cargo (bin_id, cargo_id, quantity) VALUES (?, ?, ?)`,
    [bin_id, cargo_id, quantity],
    (err) => {
      if (err) {
        console.error('Ошибка SQL в POST /bin_cargo:', err.message);
        return res.status(500).json({ error: `Ошибка привязки груза: ${err.message}` });
      }
      console.log('Груз привязан:', { bin_id, cargo_id, quantity });
      res.status(201).json({ message: 'Груз успешно привязан', bin_id, cargo_id, quantity });
    }
  );
});

router.get('/recommend', async (req, res) => {
  const { cargoName } = req.query;

  if (!cargoName) {
    return res.status(400).json({ error: 'Укажите cargoName' });
  }

  console.log(`🔍 Рекомендация ячеек для груза: "${cargoName}"`);

  // 1. Получаем прогноз для этого товара
  const forecastSql = `
        SELECT recommended_zone 
        FROM forecast 
        WHERE LOWER(product_name) = LOWER(?)
        ORDER BY last_calculated DESC 
        LIMIT 1
    `;

  db.get(forecastSql, [cargoName], (err, forecast) => {
    if (err || !forecast) {
      // Если прогноза нет — возвращаем обычные свободные ячейки
      return getFreeBins(res, null);
    }

    getFreeBins(res, forecast.recommended_zone);
  });
});

function getFreeBins(res, preferredZone = null) {
  const sql = `
        SELECT 
            w.name AS warehouse,
            r.name AS rack,
            s.level AS shelf,
            b.cell_number AS cell,
            b.id AS bin_id,
            (b.max_volume - b.current_volume) AS free_volume,
            ? AS recommended_zone
        FROM bin b
        JOIN shelf s ON b.shelf_id = s.id
        JOIN rack r ON s.rack_id = r.id
        JOIN warehouse w ON r.warehouse_id = w.id
        WHERE (b.max_volume - b.current_volume) > 0
        ORDER BY 
            CASE 
                WHEN ? = 'hot_zone' AND ? = 'hot_zone' THEN 1
                WHEN ? = 'warm_zone' AND ? IN ('hot_zone', 'warm_zone') THEN 2
                ELSE 3
            END,
            (b.max_volume - b.current_volume) DESC
        LIMIT 10
    `;

  db.all(sql, [preferredZone, preferredZone, preferredZone, preferredZone], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Ошибка рекомендаций' });
    }
    res.json(rows);
  });
}

export default router;