import React, { useState } from 'react';
import useWarehouseApi from '../hooks/useWarehouseApi';

const AddCargoForm = ({ structure, onSubmit }) => {
  const { getRecommendedBins } = useWarehouseApi();
  const [cargoData, setCargoData] = useState({
    name: '',
    bin_id: '',
    quantity: '1',
    // значения по умолчанию (быстрое добавление)
    width: '20',
    height: '20',
    depth: '20'
  });

  const [recommendedBins, setRecommendedBins] = useState([]);
  const [showRecommendation, setShowRecommendation] = useState(false);

  const handleRecommendBins = async () => {
    if (!cargoData.name) {
      alert('Сначала введите название груза');
      return;
    }
    try {
      const bins = await getRecommendedBins(cargoData.name);  // ← из хука
      setRecommendedBins(bins);
      setShowRecommendation(true);
    } catch (err) {
      console.error(err);
      alert('Ошибка получения рекомендаций');
    }
  };

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

        {showRecommendation && (
            <div style={{ margin: '15px 0', padding: '12px', background: '#4682B4', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 8px 0' }}>🔥 Рекомендуемые ячейки по прогнозу спроса</h4>
              {recommendedBins.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {recommendedBins.map(bin => (
                        <li key={bin.bin_id} style={{ marginBottom: '6px' }}>
                          📍 {bin.warehouse} → Стеллаж {bin.rack} → Этаж {bin.shelf} → Ячейка {bin.cell}
                          <span style={{
                            marginLeft: '10px',
                            padding: '2px 8px',
                            fontSize: '0.8em',
                            borderRadius: '12px',
                            background: bin.recommended_zone === 'hot_zone' ? '#f57676' :
                                bin.recommended_zone === 'warm_zone' ? '#f57676' : '#f5cd76'
                          }}>
                            {bin.recommended_zone} ({bin.free_volume.toFixed(0)} см³ свободно)
                        </span>
                        </li>
                    ))}
                  </ul>
              ) : (
                  <p style={{ color: '#888' }}>Нет подходящих ячеек по габаритам</p>
              )}
            </div>
        )}

        <button
            type="button"
            onClick={handleRecommendBins}
            style={{ marginRight: '10px' }}
        >
          🔍 Найти лучшие ячейки по прогнозу
        </button>

      </div>
  );
};

export default AddCargoForm;