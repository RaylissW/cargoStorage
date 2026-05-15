import React, { useState, useEffect } from 'react';
import useWarehouseApi from '../hooks/useWarehouseApi';
import StorageParamsForm from './StorageParamsForm';

const AddCargoForm = ({ structure }) => {
  const { getRecommendedBins, createCargo, assignCargoToBin } = useWarehouseApi();

  const [cargoData, setCargoData] = useState({
    name: '',
    quantity: '1',
    width: '20',
    height: '20',
    depth: '20'
  });

  const [storageParams, setStorageParams] = useState({
    temp_min: '',
    temp_max: '',
    humidity_min: '',
    humidity_max: '',
    is_fragile: false,
    needs_refrigeration: false
  });

  const [recommendedBins, setRecommendedBins] = useState([]);
  const [selectedBinId, setSelectedBinId] = useState(null);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [loadingRecommend, setLoadingRecommend] = useState(false);

  // Список товаров для копирования шаблона
  const [existingCargos, setExistingCargos] = useState([]);

  // Правильный useEffect
  useEffect(() => {
    const cargos = [];
    structure.forEach(warehouse => {
      warehouse.racks?.forEach(rack => {
        rack.shelves?.forEach(shelf => {
          shelf.bins?.forEach(bin => {
            bin.cargos?.forEach(cargo => {
              if (!cargos.find(c => c.name === cargo.name)) {
                cargos.push({ id: cargo.id, name: cargo.name });
              }
            });
          });
        });
      });
    });
    setExistingCargos(cargos);
  }, [structure]);

  const handleRecommendBins = async () => {
    if (!cargoData.name.trim()) {
      alert('Сначала введите название груза');
      return;
    }
    setLoadingRecommend(true);
    try {
      const bins = await getRecommendedBins(cargoData.name);
      setRecommendedBins(bins);
      setShowRecommendation(true);
      setSelectedBinId(null);
    } catch (err) {
      console.error(err);
      alert('Ошибка получения рекомендаций');
    } finally {
      setLoadingRecommend(false);
    }
  };

  const handleSelectBin = (binId) => setSelectedBinId(binId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBinId) {
      alert('Выберите ячейку из рекомендаций');
      return;
    }

    const fullCargoData = {
      name: cargoData.name,
      width: parseFloat(cargoData.width) || 20,
      height: parseFloat(cargoData.height) || 20,
      depth: parseFloat(cargoData.depth) || 20,
      storageParams: storageParams   // ← теперь правильно берём отдельное состояние
    };

    const cargo = await createCargo(fullCargoData);

    if (cargo) {
      await assignCargoToBin(
          parseInt(selectedBinId),
          cargo.id,
          parseInt(cargoData.quantity) || 1
      );

      // Сброс формы
      setCargoData({ name: '', quantity: '1', width: '20', height: '20', depth: '20' });
      setStorageParams({
        temp_min: '', temp_max: '', humidity_min: '', humidity_max: '',
        is_fragile: false, needs_refrigeration: false
      });
      setRecommendedBins([]);
      setShowRecommendation(false);
      setSelectedBinId(null);
    }
  };

  return (
      <div className="add-cargo">
        <h2>➕ Добавить новый груз</h2>

        <form onSubmit={handleSubmit}>
          <input
              type="text"
              value={cargoData.name}
              onChange={e => setCargoData({ ...cargoData, name: e.target.value })}
              placeholder="Название груза"
              required
          />

          <input
              type="number"
              value={cargoData.quantity}
              onChange={e => setCargoData({ ...cargoData, quantity: e.target.value })}
              placeholder="Количество"
              min="1"
              required
          />

          <details style={{ margin: '15px 0' }}>
            <summary>📏 Габариты груза (по умолчанию 20×20×20 см)</summary>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <input type="number" value={cargoData.width} onChange={e => setCargoData({ ...cargoData, width: e.target.value })} placeholder="Ширина" style={{ width: '80px' }} />
              <input type="number" value={cargoData.height} onChange={e => setCargoData({ ...cargoData, height: e.target.value })} placeholder="Высота" style={{ width: '80px' }} />
              <input type="number" value={cargoData.depth} onChange={e => setCargoData({ ...cargoData, depth: e.target.value })} placeholder="Глубина" style={{ width: '80px' }} />
            </div>
          </details>

          <StorageParamsForm
              storageParams={storageParams}
              setStorageParams={setStorageParams}
              existingCargos={existingCargos}
          />

          <button
              type="button"
              onClick={handleRecommendBins}
              disabled={loadingRecommend || !cargoData.name.trim()}
              style={{ marginBottom: '15px' }}
          >
            {loadingRecommend ? '🔎 Ищем...' : '🔍 Найти лучшие ячейки по прогнозу'}
          </button>

          {showRecommendation && recommendedBins.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4>🔥 Рекомендуемые ячейки</h4>
                {recommendedBins.map(bin => (
                    <div key={bin.bin_id} style={{
                      padding: '12px',
                      marginBottom: '8px',
                      border: selectedBinId === bin.bin_id ? '2px solid #006400' : '1px solid #ddd',
                      borderRadius: '6px',
                      background: selectedBinId === bin.bin_id ? '#e6ffe6' : 'white',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        📍 {bin.warehouse} → Стеллаж {bin.rack} → Этаж {bin.shelf} → Ячейка {bin.cell}
                      </div>
                      <button
                          type="button"
                          onClick={() => handleSelectBin(bin.bin_id)}
                          style={{
                            background: selectedBinId === bin.bin_id ? '#006400' : '#28a745',
                            color: 'white',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '6px'
                          }}
                      >
                        {selectedBinId === bin.bin_id ? '✅ Выбрано' : 'Выбрать'}
                      </button>
                    </div>
                ))}
              </div>
          )}

          <button
              type="submit"
              disabled={!selectedBinId}
              style={{
                backgroundColor: selectedBinId ? '#006400' : '#ccc',
                color: 'white',
                padding: '14px',
                width: '100%'
              }}
          >
            Добавить груз в выбранную ячейку
          </button>
        </form>
      </div>
  );
};

export default AddCargoForm;