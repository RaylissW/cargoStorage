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
  const { name, width = 20.0, height = 20.0, depth = 20.0, volume, weight_per_unit = 0.5 } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Название груза обязательно' });
  }

  const finalName = name.trim().toLowerCase();           // сохраняем в нижнем регистре
  const finalVolume = volume || (width * height * depth); // если volume не передали — считаем

  const sql = `
    INSERT INTO cargo (name, width, height, depth, volume, weight_per_unit)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [finalName, width, height, depth, finalVolume, weight_per_unit], function(err) {
    if (err) {
      console.error('Ошибка создания груза:', err.message);
      return res.status(500).json({ error: `Ошибка при создании груза: ${err.message}` });
    }

    console.log(`✅ Создан груз: "${finalName}" (id=${this.lastID})`);
    res.json({
      id: this.lastID,
      name: finalName,
      width,
      height,
      depth,
      volume: finalVolume,
      weight_per_unit
    });
  });
});


export default router;