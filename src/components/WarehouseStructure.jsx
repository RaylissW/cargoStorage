import React from 'react';

const WarehouseStructure = ({ structure, onEditRack, onDeleteRack }) => {
    if (!structure || structure.length === 0) return <p>Нет данных о складе</p>;

    return (
        <div className="warehouse-structure">
            <h2>Структура хранилища</h2>
            {structure.map(warehouse => (
                <div key={warehouse.id}>
                    <h3>Склад: {warehouse.name}</h3>
                    {warehouse.racks?.map(rack => (
                        <div key={rack.id} style={{ marginLeft: '20px' }}>
                            <strong>Стеллаж: {rack.name} (этажей: {rack.floors})</strong>
                            {/* кнопки редактирования/удаления */}
                            <button onClick={() => onEditRack(rack, warehouse.id)} style={{ marginLeft: '10px' }}>Ред.</button>
                            <button onClick={() => window.confirm(`Удалить ${rack.name}?`) && onDeleteRack(rack.id, warehouse.id)} style={{ marginLeft: '5px', color: 'red' }}>Удалить</button>

                            {rack.shelves?.map(shelf => (
                                <div key={shelf.id} style={{ marginLeft: '40px' }}>
                                    Этаж: {shelf.level}
                                    {shelf.bins?.map(bin => {
                                        const occupied = bin.cargos ? bin.cargos.reduce((sum, c) => sum + (c.quantity || 0) * (c.volume || 0), 0) : 0;
                                        const fillPercent = bin.max_volume > 0 ? Math.round((occupied / bin.max_volume) * 100) : 0;
                                        return (
                                            <div key={bin.id} style={{ marginLeft: '60px', border: '1px dashed #ccc', padding: '8px', marginBottom: '8px' }}>
                                                Ячейка: {bin.cell_number}
                                                (Габариты: {bin.width}×{bin.height}×{bin.depth} см,
                                                Объём: {bin.max_volume} см³,
                                                <strong style={{ color: fillPercent > 80 ? 'red' : fillPercent > 50 ? 'orange' : 'green' }}>
                                                    {' '}{fillPercent}% заполнено
                                                </strong>)

                                                {bin.cargos && bin.cargos.length > 0 ? (
                                                    <ul>
                                                        {bin.cargos.reduce((acc, cargo) => {
                                                            const existing = acc.find(c => c.name === cargo.name);
                                                            if (existing) existing.quantity += cargo.quantity;
                                                            else acc.push({ ...cargo });
                                                            return acc;
                                                        }, []).map(cargo => (
                                                            <li key={cargo.id}>
                                                                Груз: {cargo.name} (Количество: {cargo.quantity})
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p style={{ color: '#999' }}>Нет грузов</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default WarehouseStructure;