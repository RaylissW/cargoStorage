import React, { useState } from 'react';

const StorageParamsForm = ({ storageParams, setStorageParams, existingCargos = [] }) => {
    const [loadingTemplate, setLoadingTemplate] = useState(false);

    const handleCopyFromExisting = async (cargoName) => {
        if (!cargoName) return;

        setLoadingTemplate(true);
        try {
            const res = await fetch(`http://localhost:3000/api/cargo/characteristics/${encodeURIComponent(cargoName)}`);
            if (!res.ok) throw new Error('Не удалось получить характеристики');

            const data = await res.json();

            if (Object.keys(data).length === 0) {
                alert(`Для товара "${cargoName}" пока нет сохранённых параметров хранения`);
                return;
            }

            // Подставляем значения в форму
            setStorageParams({
                temp_min: data.temp_min || '',
                temp_max: data.temp_max || '',
                humidity_min: data.humidity_min || '',
                humidity_max: data.humidity_max || '',
                is_fragile: data.is_fragile || false,
                needs_refrigeration: data.needs_refrigeration || false
            });

            console.log(`✅ Параметры скопированы из "${cargoName}"`);
        } catch (err) {
            console.error(err);
            alert('Не удалось загрузить шаблон характеристик');
        } finally {
            setLoadingTemplate(false);
        }
    };

    return (
        <details style={{ margin: '15px 0', border: '1px solid #ddd', padding: '12px', borderRadius: '8px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                ❄️ Параметры хранения товара
            </summary>

            <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>
                    Скопировать параметры из существующего товара:
                </label>
                <select
                    onChange={(e) => handleCopyFromExisting(e.target.value)}
                    disabled={loadingTemplate}
                    style={{ width: '100%', marginBottom: '12px' }}
                >
                    <option value="">— Выберите товар —</option>
                    {existingCargos.map(cargo => (
                        <option key={cargo.id} value={cargo.name}>
                            {cargo.name}
                        </option>
                    ))}
                </select>

                {loadingTemplate && <p style={{ color: '#006400' }}>⏳ Загружаем шаблон...</p>}

                {/* Остальные поля остаются без изменений */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                        <label>Температура min (°C)</label>
                        <input
                            type="number"
                            value={storageParams.temp_min}
                            onChange={(e) => setStorageParams({ ...storageParams, temp_min: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label>Температура max (°C)</label>
                        <input
                            type="number"
                            value={storageParams.temp_max}
                            onChange={(e) => setStorageParams({ ...storageParams, temp_max: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label>Влажность min (%)</label>
                        <input
                            type="number"
                            value={storageParams.humidity_min}
                            onChange={(e) => setStorageParams({ ...storageParams, humidity_min: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label>Влажность max (%)</label>
                        <input
                            type="number"
                            value={storageParams.humidity_max}
                            onChange={(e) => setStorageParams({ ...storageParams, humidity_max: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>

                <div style={{ marginTop: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '6px' }}>
                        <input
                            type="checkbox"
                            checked={storageParams.is_fragile}
                            onChange={(e) => setStorageParams({ ...storageParams, is_fragile: e.target.checked })}
                        />
                        Хрупкий товар
                    </label>

                    <label style={{ display: 'block' }}>
                        <input
                            type="checkbox"
                            checked={storageParams.needs_refrigeration}
                            onChange={(e) => setStorageParams({ ...storageParams, needs_refrigeration: e.target.checked })}
                        />
                        Требует холодильника
                    </label>
                </div>
            </div>
        </details>
    );
};

export default StorageParamsForm;