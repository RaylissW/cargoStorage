import { Router } from 'express';
import { db } from '../db/init.js';
//import {c} from "vite/dist/node/moduleRunnerTransport.d-DJ_mE5sf.js";
//import cargoSearch from "../../src/components/CargoSearch.jsx";

const router = Router();

router.get('/search', (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === '') {
    return res.status(400).json({ error: 'Введите поисковый запрос' });
  }

  const searchTerm = `%${q.trim()}%`;

  const sql = `
    SELECT 
      c.id AS cargo_id,
      c.name AS cargo_name,
      w.name AS warehouse_name,
      r.name AS rack_name,
      s.level AS shelf_level,
      b.cell_number AS bin_cell,
      bc.quantity
    FROM cargo c
    LEFT JOIN bin_cargo bc ON bc.cargo_id = c.id
    LEFT JOIN bin b ON bc.bin_id = b.id
    LEFT JOIN shelf s ON b.shelf_id = s.id
    LEFT JOIN rack r ON s.rack_id = r.id
    LEFT JOIN warehouse w ON r.warehouse_id = w.id
    WHERE c.name LIKE ? COLLATE NOCASE
    ORDER BY c.name, w.name, r.name, s.level, b.cell_number;
  `;

  db.all(sql, [searchTerm], (err, rows) => {
    if (err) {
      console.error('Ошибка поиска груза:', err.message);
      return res.status(500).json({ error: 'Ошибка поиска груза' });
    }

    const resultMap = new Map();

    rows.forEach(row => {
      if (!resultMap.has(row.cargo_id)) {
        resultMap.set(row.cargo_id, {
          id: row.cargo_id,
          name: row.cargo_name,
          locations: []
        });
      }

      if (row.warehouse_name) {
        resultMap.get(row.cargo_id).locations.push({
          warehouse: row.warehouse_name,
          rack: row.rack_name,
          shelf: row.shelf_level,
          bin: row.bin_cell,
          quantity: row.quantity || 0
        });
      }
    });

    const results = Array.from(resultMap.values());
    console.log(`🔍 Поиск по "${q}" → найдено ${results.length} результатов`);
    res.json(results);
  });
});

// Удаление груза
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  console.log('Запрос DELETE /cargo/:id:', { id });
  db.run(`DELETE FROM cargo WHERE id = ?`, [id], function(err) {
    if (err) {
      console.error('Ошибка SQL в DELETE /cargo:', err.message);
      return res.status(500).json({ error: `Ошибка при удалении груза: ${err.message}` });
    }
    if (this.changes === 0) {
      console.error('Груз не найден:', id);
      return res.status(404).json({ error: 'Груз не найден' });
    }
    console.log('Удален груз:', id);
    res.status(200).json({ message: 'Груз успешно удален' });
  });
});

router.post('/', (req, res) => {
  const {
    name,
    width = 20.0,
    height = 20.0,
    depth = 20.0,
    volume,
    weight_per_unit = 0.5,
    storageParams   // ← сюда приходят параметры хранения
  } = req.body;

  console.log('📥 Получены данные для создания груза:', {
    name,
    width,
    height,
    depth,
    storageParams: storageParams || '❌ НЕ ПЕРЕДАНЫ'
  });

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Название груза обязательно' });
  }

  const finalName = name.trim().toLowerCase();
  const finalVolume = volume || (width * height * depth);

  const sqlCargo = `
    INSERT INTO cargo (name, width, height, depth, volume, weight_per_unit)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(sqlCargo, [finalName, width, height, depth, finalVolume, weight_per_unit], function (err) {
    if (err) {
      console.error('❌ Ошибка создания груза:', err.message);
      return res.status(500).json({ error: `Ошибка при создании груза: ${err.message}` });
    }

    const cargoId = this.lastID;
    console.log(`✅ Создан груз: "${finalName}" (id=${cargoId})`);

    // === БЛОК СОХРАНЕНИЯ ПАРАМЕТРОВ ХРАНЕНИЯ ===
    if (storageParams && Object.keys(storageParams).length > 0) {
      console.log('🔧 Попытка сохранить параметры хранения:', storageParams);

      const sqlParams = `
        INSERT INTO product_characteristics (
          cargo_id, 
          temp_min, temp_max, 
          humidity_min, humidity_max,
          is_fragile, needs_refrigeration
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(sqlParams, [
        cargoId,
        storageParams.temp_min || null,
        storageParams.temp_max || null,
        storageParams.humidity_min || null,
        storageParams.humidity_max || null,
        storageParams.is_fragile ? 1 : 0,
        storageParams.needs_refrigeration ? 1 : 0
      ], function (err) {
        if (err) {
          console.error('❌ Ошибка сохранения параметров хранения:', err.message);
        } else {
          console.log(`🎉 Параметры хранения УСПЕШНО сохранены для груза id=${cargoId}`);
        }
      });
    } else {
      console.log('⚠️ storageParams отсутствует или пустой — параметры хранения НЕ сохранялись');
    }

    res.json({
      id: cargoId,
      name: finalName,
      width,
      height,
      depth,
      volume: finalVolume,
      weight_per_unit
    });
  });
});

// Получить параметры хранения по названию груза (для копирования шаблона)
router.get('/characteristics/:name', (req, res) => {
  const name = req.params.name.trim().toLowerCase();

  const sql = `
    SELECT 
      pc.temp_min, pc.temp_max, 
      pc.humidity_min, pc.humidity_max,
      pc.is_fragile, pc.needs_refrigeration
    FROM product_characteristics pc
    JOIN cargo c ON pc.cargo_id = c.id
    WHERE LOWER(c.name) = ?
    LIMIT 1
  `;

  db.get(sql, [name], (err, row) => {
    if (err) {
      console.error('Ошибка получения характеристик:', err.message);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (!row) {
      return res.json({}); // нет характеристик — возвращаем пустой объект
    }

    console.log(`📋 Найдены характеристики для "${name}":`, row);

    res.json({
      temp_min: row.temp_min,
      temp_max: row.temp_max,
      humidity_min: row.humidity_min,
      humidity_max: row.humidity_max,
      is_fragile: !!row.is_fragile,
      needs_refrigeration: !!row.needs_refrigeration
    });
  });
});
export default router;