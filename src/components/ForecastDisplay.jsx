import React, { useState, useEffect } from 'react';
import useWarehouseApi from '../hooks/useWarehouseApi';

const ForecastDisplay = () => {
    const { fetchForecasts } = useWarehouseApi();
    const [forecasts, setForecasts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const loadForecasts = async () => {
            try {
                const data = await fetchForecasts();
                if (isMounted) {
                    setForecasts(data);
                }
            } catch (err) {
                console.error('Ошибка загрузки прогнозов:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadForecasts();

        return () => { isMounted = false; }; // cleanup
    }, [fetchForecasts]); // ← зависимость правильная

    if (loading) return <p>⏳ Загрузка прогнозов спроса...</p>;

    return (
        <div className="forecast-display">
            <h2>📊 Прогноз спроса на 7 дней (XGBoost)</h2>
            <button
                onClick={async () => {
                    setLoading(true);
                    try {
                        await fetch('http://localhost:3000/api/forecast/all'); // запускаем модель
                        const data = await fetchForecasts(); // перезагружаем из БД
                        setForecasts(data);
                    } catch (e) {
                        console.error(e);
                    } finally {
                        setLoading(false);
                    }
                }}
                style={{ marginLeft: '15px', padding: '6px 12px' }}
            >
                🔄 Обновить прогнозы (запустить модель)
            </button>
            <table border="1" cellPadding="10" style={{ borderCollapse: 'collapse', width: '100%', marginTop: '10px' }}>
                <thead>
                <tr style={{ background: '#f0f0f0' }}>
                    <th>Товар</th>
                    <th>SKU</th>
                    <th>Прогноз (шт.)</th>
                    <th>Рекомендуемая зона</th>
                    <th>Обновлено</th>
                </tr>
                </thead>
                <tbody>
                {forecasts.map(f => (
                    <tr key={f.id}>
                        <td>{f.product_name}</td>
                        <td style={{ fontFamily: 'monospace' }}>{f.sku}</td>
                        <td style={{ fontWeight: 'bold', color: '#006400', textAlign: 'center' }}>
                            {Number(f.predicted_units_next_7_days).toFixed(1)}
                        </td>
                        <td>
                                <span style={{
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    fontSize: '0.85em',
                                    backgroundColor: f.recommended_zone === 'hot_zone' ? '#ffe6e6' :
                                        f.recommended_zone === 'warm_zone' ? '#fff2cc' : '#e6ffe6'
                                }}>
                                    {f.recommended_zone}
                                </span>
                        </td>
                        <td>{new Date(f.last_calculated).toLocaleString('ru-RU')}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
};

export default ForecastDisplay;