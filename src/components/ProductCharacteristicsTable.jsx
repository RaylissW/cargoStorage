import React, { useState, useEffect } from 'react';

const ProductCharacteristicsTable = () => {
    const [characteristics, setCharacteristics] = useState([]);

    const fetchCharacteristics = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/cargo/characteristics');
            const data = await res.json();
            setCharacteristics(data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchCharacteristics();
        const interval = setInterval(fetchCharacteristics, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
            <tr style={{ background: '#006400', color: 'white' }}>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>Товар</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>t min</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>t max</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>Влажн. min</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>Влажн. max</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>Хрупкий</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>Холодильник</th>
            </tr>
            </thead>
            <tbody>
            {characteristics.map(ch => (
                <tr key={ch.cargo_id}>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{ch.cargo_name}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{ch.temp_min}°C</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{ch.temp_max}°C</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{ch.humidity_min}%</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{ch.humidity_max}%</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{ch.is_fragile ? 'Да' : 'Нет'}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{ch.needs_refrigeration ? 'Да' : 'Нет'}</td>
                </tr>
            ))}
            </tbody>
        </table>
    );
};

export default ProductCharacteristicsTable;