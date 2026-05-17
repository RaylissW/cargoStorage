import React, { useState, useEffect } from 'react';

const SensorReadingsTable = () => {
    const [readings, setReadings] = useState([]);

    const fetchReadings = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/sensor/latest');
            const data = await res.json();
            setReadings(data);
        } catch (e) {
            console.error('Ошибка загрузки показаний датчиков', e);
        }
    };

    useEffect(() => {
        fetchReadings();
        const interval = setInterval(fetchReadings, 10000); // каждые 10 сек
        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                <tr style={{ background: '#006400', color: 'white' }}>
                    <th style={{ padding: '8px', border: '1px solid #ddd' }}>Датчик</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd' }}>Ячейка</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd' }}>Температура</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd' }}>Влажность</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd' }}>Давление</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd' }}>Время</th>
                </tr>
                </thead>
                <tbody>
                {readings.map(r => (
                    <tr key={r.id}>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{r.sensor_id}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                            {r.bin_location} {r.zone_name && `(${r.zone_name})`}
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{r.temperature}°C</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{r.humidity}%</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{r.pressure}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{new Date(r.timestamp).toLocaleTimeString('ru-RU')}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
};

export default SensorReadingsTable;