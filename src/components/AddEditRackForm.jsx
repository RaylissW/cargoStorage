import React from 'react';

const AddEditRackForm = ({
                           rackData,
                           setRackData,
                           editRack,
                           warehouses,
                           onSubmit,
                           onCancel
                         }) => {
  return (
    <div className="add-rack">
      <h2>{editRack ? 'Редактировать стеллаж' : 'Добавить стеллаж'}</h2>
      <select
        value={rackData.warehouse_id}
        onChange={(e) => setRackData({ ...rackData, warehouse_id: e.target.value })}
      >
        <option value="">Выберите склад</option>
        {warehouses.map(warehouse => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouse.name}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={rackData.name}
        onChange={(e) => setRackData({ ...rackData, name: e.target.value })}
        placeholder="Название стеллажа"
      />
      <input
        type="number"
        value={rackData.floors}
        onChange={(e) => setRackData({ ...rackData, floors: e.target.value })}
        placeholder="Количество этажей"
        min="1"
      />
      <button onClick={onSubmit}>
        {editRack ? 'Сохранить' : 'Добавить'}
      </button>
      {editRack && (
        <button
          onClick={() => {
            console.log('Отмена редактирования стеллажа');
            onCancel();
          }}
        >
          Отмена
        </button>
      )}
    </div>
  );
};

export default AddEditRackForm;