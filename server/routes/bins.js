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

router.get('/recommend', (req, res) => {
  const { cargoName } = req.query;
  if (!cargoName) return res.status(400).json({ error: 'Укажите cargoName' });

  console.log('🔍 [RECOMMEND] Запрос рекомендаций для груза:', cargoName);

  const sql = `
    SELECT 
      w.name AS warehouse,
      r.name AS rack,
      s.level AS shelf,
      b.cell_number AS cell,
      b.id AS bin_id,
      b.max_volume,
      COALESCE(SUM(bc.quantity * c.volume), 0) AS occupied_volume,
      (b.max_volume - COALESCE(SUM(bc.quantity * c.volume), 0)) AS free_volume,
      ROUND(100.0 * COALESCE(SUM(bc.quantity * c.volume), 0) / NULLIF(b.max_volume, 0), 1) AS fill_percent,
      COALESCE(b.temperature, 20) AS temperature,
      b.humidity,
      COALESCE(z.name, 'Не назначена') AS zone_name,
      COALESCE(f.recommended_zone, 'cold_zone') AS recommended_zone,
      pc.temp_min,
      pc.temp_max,
      -- Приоритет: если в ячейке уже есть такой же товар
      MAX(CASE WHEN LOWER(c.name) = LOWER(?) THEN 1 ELSE 0 END) AS has_same_cargo
    FROM bin b
    JOIN shelf s ON b.shelf_id = s.id
    JOIN rack r ON s.rack_id = r.id
    JOIN warehouse w ON r.warehouse_id = w.id
    LEFT JOIN zone z ON b.zone_id = z.id
    LEFT JOIN bin_cargo bc ON bc.bin_id = b.id
    LEFT JOIN cargo c ON bc.cargo_id = c.id
    LEFT JOIN forecast f ON LOWER(f.product_name) = LOWER(c.name)
    LEFT JOIN product_characteristics pc ON pc.cargo_id = c.id
    WHERE b.max_volume > 0
    GROUP BY b.id
    HAVING free_volume > 0
    ORDER BY 
      has_same_cargo DESC,                                      -- сначала те, где уже есть такой товар
      CASE WHEN b.temperature BETWEEN pc.temp_min AND pc.temp_max THEN 3 ELSE 0 END DESC,
      free_volume DESC,
      fill_percent ASC
    LIMIT 20;
  `;

  db.all(sql, [cargoName], (err, rows) => {
    if (err) {
      console.error('❌ Ошибка SQL в /recommend:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log(`✅ [RECOMMEND] Найдено ${rows.length} ячеек`);
    console.log('Первые 5 для отладки:', rows.slice(0, 5));
    res.json(rows);
  });
});
router.get('/sensor/latest', (req, res) => {
  console.log('Запрос /sensor/latest');
  db.all(`
    SELECT 
      sr.id,
      sr.sensor_id,
      sr.temperature,
      sr.humidity,
      sr.pressure,
      sr.timestamp,
      COALESCE(b.cell_number, '—') AS bin_location,   -- ← исправлено
      COALESCE(s.level, '—') AS shelf,
      COALESCE(r.name, '—') AS rack,
      COALESCE(w.name, '—') AS warehouse,
      COALESCE(z.name, 'Не назначена') AS zone_name   -- ← добавили зону
    FROM sensor_reading sr
    LEFT JOIN sensor se ON sr.sensor_id = se.id
    LEFT JOIN bin b ON se.bin_id = b.id
    LEFT JOIN shelf s ON b.shelf_id = s.id
    LEFT JOIN rack r ON s.rack_id = r.id
    LEFT JOIN warehouse w ON r.warehouse_id = w.id
    LEFT JOIN zone z ON b.zone_id = z.id
    ORDER BY sr.timestamp DESC
    LIMIT 50
  `, [], (err, rows) => {
    if (err) {
      console.error('Ошибка /sensor/latest:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log(`✅ /sensor/latest вернул ${rows.length} записей`);
    res.json(rows);
  });
});
router.get('/cargo/characteristics', (req, res) => {
  db.all(`
    SELECT 
      c.name AS cargo_name,
      pc.temp_min,
      pc.temp_max,
      pc.humidity_min,
      pc.humidity_max,
      pc.is_fragile,
      pc.needs_refrigeration
    FROM product_characteristics pc
    JOIN cargo c ON pc.cargo_id = c.id
    ORDER BY c.name
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.patch('/bin_cargo/increment', (req, res) => {
  const { bin_id, cargo_id, quantity } = req.body;

  if (!bin_id || !cargo_id || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'bin_id, cargo_id и quantity > 0 обязательны' });
  }

  console.log(`📥 UPSERT bin_cargo: bin=${bin_id}, cargo=${cargo_id}, +${quantity}`);

  db.run(`
    INSERT INTO bin_cargo (bin_id, cargo_id, quantity)
    VALUES (?, ?, ?)
    ON CONFLICT(bin_id, cargo_id) 
    DO UPDATE SET quantity = quantity + ?
  `, [bin_id, cargo_id, quantity, quantity], function (err) {
    if (err) {
      console.error('❌ Ошибка UPSERT:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log(`✅ Груз успешно добавлен/увеличен (changes=${this.changes})`);
    res.json({
      message: 'Груз успешно добавлен/увеличен',
      bin_id,
      cargo_id,
      quantity: quantity
    });
  });
});


router.get('/AddMeasure', (req, res) => {
  const {
    sens: sensor_id,
    temp,
    hum,
    press,
    tS: temp_smooth,
    hS: hum_smooth,
    pS: press_smooth,
    time: timestamp
  } = req.query;

  console.log('\n' + '='.repeat(60));
  console.log('📡 ПОКАЗАНИЕ ОТ ДАТЧИКА ПОЛУЧЕНО');
  console.log('=' .repeat(60));
  console.log(`📌 Sensor ID     : ${sensor_id}`);
  console.log(`🌡️  Температура   : ${temp} °C (сглаженное: ${temp_smooth} °C)`);
  console.log(`💧 Влажность     : ${hum} % (сглаженное: ${hum_smooth} %)`);
  console.log(`📈 Давление      : ${press} мм рт. ст. (сглаженное: ${press_smooth} мм рт. ст.)`);
  console.log(`⏰ Время         : ${timestamp || new Date().toISOString()}`);
  console.log('='.repeat(60));

  if (!sensor_id) {
    console.log('❌ Ошибка: sensor_id не передан');
    return res.status(400).json({ error: 'sensor_id обязателен' });
  }

  // Сохраняем в историю
  db.run(`
    INSERT INTO sensor_reading (sensor_id, timestamp, temperature, humidity, pressure)
    VALUES (?, ?, ?, ?, ?)
  `, [sensor_id, timestamp || new Date().toISOString(), parseFloat(temp), parseFloat(hum), parseFloat(press)]);

  // Обновляем последние показания в bin
  db.run(`
    UPDATE bin
    SET temperature = ?,
        humidity = ?,
        pressure = ?,
        last_measurement = CURRENT_TIMESTAMP
    WHERE id = (SELECT bin_id FROM sensor WHERE id = ?)
  `, [parseFloat(temp), parseFloat(hum), parseFloat(press), sensor_id]);

  console.log(`✅ Данные успешно сохранены для sensor_id = ${sensor_id}`);
  res.json({ status: 'ok', message: 'Данные датчика приняты' });
});

export default router;
