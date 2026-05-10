import React, { useState } from 'react';
import useWarehouseApi from '../hooks/useWarehouseApi.js';

const CargoSearch = () => {
  const { searchCargo, deleteCargo } = useWarehouseApi();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    const data = await searchCargo(query);
    setResults(data);
    setLoading(false);
  };

  const handleDelete = async (cargoId, binId, cargoName) => {
    if (!window.confirm(`Удалить груз "${cargoName}" из этой ячейки?`)) return;

    const success = await deleteCargo(cargoId, binId);
    if (success) {
      // Обновляем локальный список результатов
      setResults(prev => prev.filter(cargo => cargo.id !== cargoId));
    }
  };

  return (
      <div className="cargo-search">
        <h3>🔎 Поиск груза</h3>
        <form onSubmit={handleSearch}>
          <input
              type="text"
              placeholder="Введите название груза (например: наушники)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: '300px', padding: '8px' }}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Ищем...' : 'Найти'}
          </button>
        </form>

        {results.length > 0 ? (
            <div>
              <h4>Результаты ({results.length}):</h4>
              {results.map((cargo) => (
                  <div key={cargo.id} style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ddd' }}>
                    <strong>{cargo.name}</strong>
                    {cargo.locations.map((loc, i) => (
                        <div key={i} style={{ marginLeft: '20px', fontSize: '0.95em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    📍 {loc.warehouse} → Стеллаж {loc.rack} → Этаж {loc.shelf} → Ячейка {loc.bin}
                    <span style={{ color: '#006400' }}> ({loc.quantity} шт.)</span>
                  </span>
                          <button
                              onClick={() => handleDelete(cargo.id, loc.bin, cargo.name)}
                              style={{ color: 'red', fontSize: '0.85em', padding: '4px 8px' }}
                          >
                            Удалить
                          </button>
                        </div>
                    ))}
                  </div>
              ))}
            </div>
        ) : results.length === 0 && query && !loading ? (
            <p style={{ color: '#999' }}>По вашему запросу ничего не найдено</p>
        ) : null}
      </div>
  );
};

export default CargoSearch;