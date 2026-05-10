import React, { useState } from 'react';

const AddCargoForm = ({ structure, onSubmit }) => {
  const [cargoData, setCargoData] = useState({
    name: '',
    bin_id: '',
    quantity: '1',
    // значения по умолчанию (быстрое добавление)
    width: '20',
    height: '20',
    depth: '20'
  });

  // Формируем список ячеек
  const binOptions = [];
  structure.forEach(warehouse => {
    warehouse.racks.forEach(rack => {
      rack.shelves.forEach(shelf => {
        shelf.bins.forEach(bin => {
          binOptions.push({
            bin_id: bin.id,
            label: `Склад ${warehouse.name}, Стеллаж ${rack.name}, Этаж ${shelf.level}, Ячейка ${bin.cell_number}`
          });
        });
      });
    });
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(cargoData);
    // сброс формы
    setCargoData({
      name: '',
      bin_id: '',
      quantity: '1',
      width: '20',
      height: '20',
      depth: '20'
    });
  };

  return (
      <div className="add-cargo">
        <h2>Добавить груз</h2>
        <form onSubmit={handleSubmit}>
          <input
              type="text"
              value={cargoData.name}
              onChange={(e) => setCargoData({ ...cargoData, name: e.target.value })}
              placeholder="Название груза"
              required
          />

          <select
              value={cargoData.bin_id}
              onChange={(e) => setCargoData({ ...cargoData, bin_id: e.target.value })}
              required
          >
            <option value="">Выберите ячейку</option>
            {binOptions.map(option => (
                <option key={option.bin_id} value={option.bin_id}>
                  {option.label}
                </option>
            ))}
          </select>

          <input
              type="number"
              value={cargoData.quantity}
              onChange={(e) => setCargoData({ ...cargoData, quantity: e.target.value })}
              placeholder="Количество"
              min="1"
              required
          />

          {/* Габариты по умолчанию (можно оставить скрытыми или показать) */}
          <details style={{ marginTop: '10px' }}>
            <summary>Габариты (по умолчанию 20×20×20 см)</summary>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <input type="number" value={cargoData.width} onChange={e => setCargoData({...cargoData, width: e.target.value})} placeholder="Ширина" style={{width: '80px'}} />
              <input type="number" value={cargoData.height} onChange={e => setCargoData({...cargoData, height: e.target.value})} placeholder="Высота" style={{width: '80px'}} />
              <input type="number" value={cargoData.depth} onChange={e => setCargoData({...cargoData, depth: e.target.value})} placeholder="Глубина" style={{width: '80px'}} />
            </div>
          </details>

          <button type="submit">Добавить груз</button>
        </form>
      </div>
  );
};

export default AddCargoForm;