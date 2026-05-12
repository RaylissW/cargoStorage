import { useState, useEffect, useCallback } from 'react';

const useWarehouseApi = () => {
  const [structure, setStructure] = useState([]);
  const [error, setError] = useState(null);

  // Загрузка структуры и тестовый запрос
  useEffect(() => {
    const fetchTest = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/test');
        const data = await res.json();
        console.log('Тестовый запрос:', data);
      } catch (err) {
        console.error('Ошибка тестового запроса:', err);
      }
    };

    const fetchStructure = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/structure');
        console.log('Статус ответа /api/structure:', res.status);
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        const data = await res.json();
        console.log('Получена структура:', data);
        if (data.error) {
          setError(data.error);
          setStructure([]);
        } else {
          setError(null);
          setStructure(data);
        }
      } catch (err) {
        console.error('Ошибка получения структуры:', err);
        setError('Не удалось загрузить структуру');
        setStructure([]);
      }
    };

    fetchTest();
    fetchStructure();
  }, []);

  // Создание стеллажа
  const createRack = async (rackData) => {
    const payload = {
      warehouse_id: parseInt(rackData.warehouse_id),
      name: rackData.name,
      floors: parseInt(rackData.floors)
    };
    console.log('Отправка данных для добавления стеллажа:', payload);
    try {
      const response = await fetch('http://localhost:3000/api/racks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('Ответ сервера (POST /racks):', response.status, response.statusText);
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Ошибка сервера' };
        }
        console.error('Ошибка сервера:', errorData);
        setError(errorData.error || 'Ошибка добавления стеллажа');
        return null;
      }
      const newRack = await response.json();
      console.log('Новый стеллаж:', newRack);
      newRack.shelves = newRack.shelves || [];
      setStructure(prev => prev.map(warehouse =>
        warehouse.id === payload.warehouse_id
          ? { ...warehouse, racks: [...warehouse.racks, newRack] }
          : warehouse
      ));
      setError(null);
      return newRack;
    } catch (err) {
      console.error('Ошибка при добавлении стеллажа:', err.message);
      setError('Не удалось добавить стеллаж');
      return null;
    }
  };

  // Обновление стеллажа
  const updateRack = async (rackId, rackData, warehouseId) => {
    const payload = {
      name: rackData.name,
      floors: parseInt(rackData.floors)
    };
    console.log('Отправка данных для редактирования стеллажа:', payload);
    try {
      const response = await fetch(`http://localhost:3000/api/racks/${rackId}`, {
  method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});
console.log('Ответ сервера (PUT /racks):', response.status, response.statusText);
if (!response.ok) {
  let errorData;
  try {
    errorData = await response.json();
  } catch {
    errorData = { error: 'Ошибка сервера' };
  }
  console.error('Ошибка сервера:', errorData);
  setError(errorData.error || 'Ошибка редактирования стеллажа');
  return null;
}
const updatedRack = await response.json();
console.log('Обновленный стеллаж:', updatedRack);
updatedRack.shelves = updatedRack.shelves || [];
setStructure(prev => prev.map(warehouse =>
  warehouse.id === parseInt(warehouseId)
    ? {
      ...warehouse,
      racks: warehouse.racks.map(r =>
        r.id === parseInt(updatedRack.id) ? updatedRack : r
      )
    }
    : warehouse
));
setError(null);
return updatedRack;
} catch (err) {
  console.error('Ошибка при редактировании стеллажа:', err.message);
  setError('Не удалось редактировать стеллаж');
  return null;
}
};

// Удаление стеллажа
const deleteRack = async (rackId, warehouseId) => {
  console.log('Отправка запроса на удаление:', { rackId, warehouseId });
  try {
    const response = await fetch(`http://localhost:3000/api/racks/${rackId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Ответ сервера (DELETE /racks):', response.status, response.statusText);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: `Ошибка сервера: ${response.statusText}` };
      }
      console.error('Ошибка сервера:', errorData);
      setError(errorData.error || 'Ошибка удаления стеллажа');
      return false;
    }
    console.log('Стеллаж удален:', rackId);
    setStructure(prev => prev.map(warehouse =>
      warehouse.id === warehouseId
        ? { ...warehouse, racks: warehouse.racks.filter(r => r.id !== rackId) }
        : warehouse
    ));
    setError(null);
    return true;
  } catch (err) {
    console.error('Ошибка при удалении стеллажа:', err.message);
    setError('Не удалось удалить стеллаж');
    return false;
  }
};

// Создание груза
const createCargo = async (name) => {
  console.log('Отправка данных для создания груза:', { name });
  try {
    const response = await fetch('http://localhost:3000/api/cargo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    console.log('Ответ сервера (POST /cargo):', response.status, response.statusText);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: 'Ошибка сервера' };
      }
      console.error('Ошибка сервера:', errorData);
      setError(errorData.error || 'Ошибка добавления груза');
      return null;
    }
    const newCargo = await response.json();
    console.log('Новый груз:', newCargo);
    setError(null);
    return newCargo;
  } catch (err) {
    console.error('Ошибка при добавлении груза:', err.message);
    setError('Не удалось добавить груз');
    return null;
  }
};

// Удаление груза

  // Удаление груза
  const deleteCargo = async (cargoId, binId) => {
    console.log('Отправка запроса на удаление груза:', { cargoId, binId });

    try {
      const response = await fetch(`http://localhost:3000/api/cargo/${cargoId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('Ответ сервера (DELETE /cargo):', response.status, response.statusText);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `Ошибка сервера: ${response.statusText}` };
        }
        console.error('Ошибка сервера:', errorData);
        setError(errorData.error || 'Ошибка удаления груза');
        return false;
      }

      console.log('Груз успешно удален:', { cargoId, binId });

      // Обновляем структуру: удаляем груз из соответствующей ячейки
      setStructure(prev => {
        const newStructure = JSON.parse(JSON.stringify(prev));
        newStructure.forEach(warehouse => {
          warehouse.racks.forEach(rack => {
            rack.shelves.forEach(shelf => {
              shelf.bins.forEach(bin => {
                if (bin.id === binId && bin.cargos) {
                  // Удаляем груз из списка cargos в ячейке
                  bin.cargos = bin.cargos.filter(cargo => cargo.id !== cargoId);
                }
              });
            });
          });
        });
        return newStructure;
      });

      setError(null);
      return true;
    } catch (err) {
      console.error('Ошибка при удалении груза:', err.message);
      setError('Не удалось удалить груз');
      return false;
    }
  };


// Привязка груза к ячейке
const assignCargoToBin = async (bin_id, cargo_id, quantity) => {
  const payload = { bin_id, cargo_id, quantity };
  console.log('Отправка данных для привязки груза:', payload);
  try {
    const response = await fetch('http://localhost:3000/api/bin_cargo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('Ответ сервера (POST /bin_cargo):', response.status, response.statusText);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: 'Ошибка сервера' };
      }
      console.error('Ошибка сервера:', errorData);
      setError(errorData.error || 'Ошибка привязки груза');
      return false;
    }
    const result = await response.json();
    console.log('Груз привязан:', result);
    setStructure(prev => {
      const newStructure = JSON.parse(JSON.stringify(prev));
      newStructure.forEach(warehouse => {
        warehouse.racks.forEach(rack => {
          rack.shelves.forEach(shelf => {
            shelf.bins.forEach(bin => {
              if (bin.id === bin_id) {
                if (!bin.cargos) bin.cargos = [];
                bin.cargos.push({
                  id: cargo_id,
                  name: result.name || 'Unknown',
                  quantity
                });
              }
            });
          });
        });
      });
      return newStructure;
    });
    setError(null);
    return true;
  } catch (err) {
    console.error('Ошибка при привязке груза:', err.message);
    setError('Не удалось привязать груз');
    return false;
  }
};

const updateBin = async (binId) => {

}


// Поиск грузов
  const searchCargo = async (query) => {
    try {
      console.log(`🔍 Поиск груза: "${query}"`);
      const response = await fetch(`http://localhost:3000/api/cargo/search?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка поиска');
      }

      const data = await response.json();
      console.log(`✅ Найдено результатов: ${data.length}`);
      return data;
    } catch (error) {
      console.error('Ошибка searchCargo:', error);
      setError(error.message);
      return [];
    }
  };

// Получение URL для QR-кода ячейки
const getBinQRUrl = async (binId, type = 'link') => {
  console.log('Получение URL для QR-кода ячейки:', { binId, type });
  try {
    const baseUrl = 'http://localhost:3000'; // Абсолютный URL для корректной работы
    if (type === 'image') {
      const response = await fetch(`${baseUrl}/api/bin/${binId}/qr-image`, {
        method: 'GET',
        headers: { 'Content-Type': 'image/png' }
      });
      console.log('Ответ сервера (GET /bin/:id/qr-image):', response.status, response.statusText);
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Ошибка сервера' };
        }
        console.error('Ошибка сервера:', errorData);
        setError(errorData.error || 'Ошибка получения QR-изображения');
        return null;
      }
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      console.log('URL изображения QR:', imageUrl);
      setError(null);
      return imageUrl;
    } else {
      const response = await fetch(`${baseUrl}/api/bin/${binId}/cargo`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('Ответ сервера (GET /bin/:id/cargo):', response.status, response.statusText);
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Ошибка сервера' };
        }
        console.error('Ошибка сервера:', errorData);
        setError(errorData.error || 'Ошибка получения данных ячейки');
        return null;
      }
      const binData = await response.json();
      console.log('Данные ячейки:', binData);
      const qrUrl = `${baseUrl}/api/bin/${binId}/qr`; // Абсолютный путь для скачивания
      setError(null);
      return qrUrl;
    }
  } catch (err) {
    console.error('Ошибка при получении URL для QR-кода:', err.message);
    setError('Не удалось получить данные ячейки');
    return null;
  }
};

  const fetchForecasts = useCallback(async () => {
    const res = await fetch('http://localhost:3000/api/forecast');
    if (!res.ok) throw new Error('Failed to fetch forecasts');
    return await res.json();
  }, []);

  const getRecommendedBins = useCallback(async (cargoName) => {
    const res = await fetch(
        `http://localhost:3000/api/bin/recommend?cargoName=${encodeURIComponent(cargoName)}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }, []);

  return {
    structure,
    error,
    createRack,
    updateRack,
    deleteRack,
    createCargo,
    deleteCargo,
    assignCargoToBin,
    searchCargo,
    getBinQRUrl,
    fetchForecasts,
    getRecommendedBins
  };
};

export default useWarehouseApi;