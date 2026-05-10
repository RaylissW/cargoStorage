import React from 'react';

const WarehouseStructure = ({ structure, onEditRack, onDeleteRack }) => {
  if (structure.length === 0) {
    return <p>Нет данных</p>;
  }

  return (
    <div className="warehouse-structure">
      <h2>Структура хранилища</h2>
      {structure.map(warehouse => (
        <div key={warehouse.id}>
          <h3>Склад: {warehouse.name}</h3>
          {warehouse.racks.length === 0 ? (
            <p>Нет стеллажей</p>
          ) : (
            <ul>
              {warehouse.racks.map(rack => (
                <li key={rack.id}>
                  <div>
                    Стеллаж: {rack.name} (Этажей: {rack.floors})
                    <button
                      onClick={() => onEditRack(rack, warehouse.id)}
                      style={{ marginLeft: '10px' }}
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Удалить стеллаж "${rack.name}"?`)) {
                          onDeleteRack(rack.id, warehouse.id);
                        }
                      }}
                      style={{ marginLeft: '10px', color: 'red' }}
                    >
                      Удалить
                    </button>
                  </div>
                  {!rack.shelves || rack.shelves.length === 0 ? (
                    <p>Нет этажей</p>
                  ) : (
                    <ul>
                      {rack.shelves.map(shelf => (
                        <li key={shelf.id}>
                          Этаж: {shelf.level}
                          {!shelf.bins || shelf.bins.length === 0 ? (
                            <p>Нет ячеек</p>
                          ) : (
                            <ul>
                              {shelf.bins.map(bin => (
                                <li key={bin.id}>
                                  Ячейка: {bin.cell_number} (Габариты: {bin.width}x{bin.height}x{bin.depth} см, Объем: {bin.max_volume} куб.см)
                                  {bin.cargos && bin.cargos.length > 0 ? (
                                    <ul>
                                      {bin.cargos.map(cargo => (
                                        <li key={cargo.id}>
                                          Груз: {cargo.name} (Количество: {cargo.quantity})
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p>Нет грузов</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

export default WarehouseStructure;
