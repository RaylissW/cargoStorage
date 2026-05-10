import express from 'express';
import { db } from '../db/init.js';

const router = express.Router();

// Создание стеллажа
router.post('/', (req, res) => {
  const { warehouse_id, name, floors } = req.body;
  console.log('Запрос POST /racks:', { warehouse_id, name, floors });
  if (!warehouse_id || !name || floors == null || floors <= 0) {
    console.error('Некорректные данные в POST /racks:', { warehouse_id, name, floors });
    return res.status(400).json({ error: 'Все поля обязательны, floors должен быть > 0' });
  }
  db.run(`INSERT INTO rack (warehouse_id, name, floors) VALUES (?, ?, ?)`,
    [warehouse_id, name, floors], function(err) {
      if (err) {
        console.error('Ошибка SQL в POST /racks:', err.message);
        return res.status(500).json({ error: `Ошибка добавления стеллажа: ${err.message}` });
      }
      const rackId = this.lastID;
      console.log('Создан стеллаж:', { id: rackId, warehouse_id, name, floors });
      const newRack = { id: rackId, warehouse_id, name, floors, shelves: [] };

      db.serialize(() => {
        // Фиксированное количество ячеек на полку (5 на данном этапе)
        const binsPerShelf = 5;
        for (let level = 1; level <= floors; level++) {
          db.run(`INSERT INTO shelf (rack_id, level) VALUES (?, ?)`, [rackId, level], function(err) {
            if (err) {
              console.error('Ошибка добавления этажа:', err.message);
              return;
            }
            const shelfId = this.lastID;
            console.log(`Добавлен этаж ${level} для стеллажа ${rackId}, shelfId: ${shelfId}`);
            newRack.shelves.push({ id: shelfId, level, bins: [] });

            // Добавляем указанное количество ячеек на каждый этаж
            for (let cellNumber = 1; cellNumber <= binsPerShelf; cellNumber++) {
              db.run(`INSERT INTO bin (shelf_id, cell_number, width, height, depth, max_volume, current_volume)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [shelfId, cellNumber, 50.0, 50.0, 50.0, 50.0 * 50.0 * 50.0, 0.0], function(err) {
                  if (err) {
                    console.error('Ошибка добавления ячейки:', err.message);
                    return;
                  }
                  const binId = this.lastID;
                  console.log(`Добавлена ячейка ${cellNumber} для этажа ${shelfId}`);
                  newRack.shelves.find(s => s.id === shelfId).bins.push({
                    id: binId,
                    cell_number: cellNumber,
                    width: 50.0,
                    height: 50.0,
                    depth: 50.0,
                    max_volume: 50.0 * 50.0 * 50.0,
                    cargos: []
                  });
                });
            }
          });
        }
      });

      // Возвращаем полный объект стеллажа
      setTimeout(() => {
        console.log('Отправлен новый стеллаж:', newRack);
        res.json(newRack);
      }, 100);
    });
});

// Редактирование стеллажа
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, floors } = req.body;
  console.log('Запрос PUT /racks/:id:', { id, name, floors });
  if (!name || floors == null || floors <= 0) {
    console.error('Некорректные данные в PUT /racks:', { name, floors });
    return res.status(400).json({ error: 'Название и floors должны быть указаны, floors > 0' });
  }
  db.run(`UPDATE rack SET name = ?, floors = ? WHERE id = ?`, [name, floors, id], function(err) {
    if (err) {
      console.error('Ошибка SQL в PUT /racks:', err.message);
      return res.status(500).json({ error: `Ошибка редактирования стеллажа: ${err.message}` });
    }
    if (this.changes === 0) {
      console.error('Стеллаж не найден:', id);
      return res.status(404).json({ error: 'Стеллаж не найден' });
    }
    console.log('Обновлен стеллаж:', { id, name, floors });
    db.run(`DELETE FROM shelf WHERE rack_id = ?`, [id], (err) => {
      if (err) {
        console.error('Ошибка удаления этажей:', err.message);
      } else {
        console.log(`Удалены этажи для стеллажа ${id}`);
      }
      const updatedRack = { id: parseInt(id), name, floors, shelves: [] };
      const binsPerShelf = 5; // Фиксированное количество ячеек
      for (let level = 1; level <= floors; level++) {
        db.run(`INSERT INTO shelf (rack_id, level) VALUES (?, ?)`, [id, level], function(err) {
          if (err) {
            console.error('Ошибка при добавлении уровня:', err.message);
            return;
          }
          const shelfId = this.lastID;
          console.log(`Добавлен уровень ${level} для стеллажа ${id}`);
          updatedRack.shelves.push({ id: shelfId, level, bins: [] });

          for (let cellNumber = 1; cellNumber <= binsPerShelf; cellNumber++) {
            db.run(`INSERT INTO bin (shelf_id, cell_number, width, height, depth, max_volume, current_volume)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [shelfId, cellNumber, 50.0, 50.0, 50.0, 50.0 * 50.0 * 50.0, 0.0], function(err) {
                if (err) {
                  console.error('Ошибка при добавлении ячейки:', err.message);
                  return;
                }
                const binId = this.lastID;
                console.log(`Добавлена ячейка ${cellNumber} для уровня ${shelfId}`);
                updatedRack.shelves.find(s => s.id === shelfId).bins.push({
                  id: binId,
                  cell_number: cellNumber,
                  width: 50.0,
                  height: 50.0,
                  depth: 50.0,
                  max_volume: 50.0 * 50.0 * 50.0,
                  cargos: []
                });
              });
          }
        });
      }
      setTimeout(() => {
        console.log('Отправлен обновленный стеллаж:', updatedRack);
        res.json(updatedRack);
      }, 100);
    });
  });
});

// Удаление стеллажа
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  console.log('Запрос DELETE /racks/:id:', { id });
  db.run(`DELETE FROM rack WHERE id = ?`, [id], function(err) {
    if (err) {
      console.error('Ошибка SQL в DELETE /racks:', err.message);
      return res.status(500).json({ error: `Ошибка при удалении стеллажа: ${err.message}` });
    }
    if (this.changes === 0) {
      console.error('Стеллаж не найден:', id);
      return res.status(404).json({ error: 'Стеллаж не найден' });
    }
    console.log('Удален стеллаж:', id);
    res.status(200).json({ message: 'Стеллаж успешно удален' });
  });
});

export default router;