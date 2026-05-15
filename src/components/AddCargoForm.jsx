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
      const uniqueBins = bins.filter((bin, index, self) =>
          index === self.findIndex(b => b.warehouse === bin.warehouse && b.rack === bin.rack)
      );
      setRecommendedBins(uniqueBins);
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
                <h4>🔥 Рекомендуемые ячейки ({recommendedBins.length})</h4>
                {recommendedBins.map(bin => {
                  const isSelected = selectedBinId === bin.bin_id;
                  const fillColor = bin.fill_percent > 80 ? '#ffe6e6' :
                      bin.fill_percent > 60 ? '#fff2cc' : '#e6ffe6';

                  return (
                      <div key={bin.bin_id} style={{
                        padding: '14px',
                        marginBottom: '10px',
                        border: isSelected ? '3px solid #006400' : '1px solid #ddd',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? '#e6ffe6' : fillColor,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: isSelected ? '0 0 8px rgba(0,100,0,0.3)' : 'none'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                            📍 {bin.warehouse} → Стеллаж {bin.rack} → Этаж {bin.shelf} → Ячейка {bin.cell}
                          </div>
                          <div style={{ fontSize: '0.9em', color: '#555' }}>
                            Свободно: <strong>{Math.round(bin.free_volume)} см³</strong> •
                            Заполнено: <strong>{bin.fill_percent}%</strong>
                          </div>
                          <div style={{
                            display: 'inline-block',
                            marginTop: '6px',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '0.85em',
                            backgroundColor: bin.recommended_zone === 'hot_zone' ? '#ffe6e6' :
                                bin.recommended_zone === 'warm_zone' ? '#fff2cc' : '#e6ffe6',
                            color: bin.recommended_zone === 'hot_zone' ? '#c00' :
                                bin.recommended_zone === 'warm_zone' ? '#c80' : '#080'
                          }}>
                            {bin.recommended_zone === 'hot_zone' ? '🔥 Горячая зона' :
                                bin.recommended_zone === 'warm_zone' ? '🌡️ Тёплая зона' : '❄️ Холодная зона'}
                          </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => handleSelectBin(bin.bin_id)}
                            style={{
                              background: isSelected ? '#006400' : '#28a745',
                              color: 'white',
                              border: 'none',
                              padding: '8px 16px',
                              borderRadius: '6px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              minWidth: '90px'
                            }}
                        >
                          {isSelected ? '✅ Выбрано' : 'Выбрать'}
                        </button>
                      </div>
                  );
                })}
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