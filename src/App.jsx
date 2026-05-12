import React, { useState } from 'react';
import './App.css';
import useWarehouseApi from './hooks/useWarehouseApi';
import ErrorMessage from './components/ErrorMessage';
import AddEditRackForm from './components/AddEditRackForm';
import WarehouseStructure from './components/WarehouseStructure';
import AddCargoForm from './components/AddCargoForm';
import CargoSearch from './components/CargoSearch';
import GenerateBinQR from './components/GenerateBinQR';
import ForecastDisplay from "./components/ForecastDisplay.jsx";
function App() {
    const { structure, error, createRack, updateRack, deleteRack, deleteCargo, createCargo, assignCargoToBin, searchCargo, getBinQRUrl } = useWarehouseApi();
    const [rackData, setRackData] = useState({ warehouse_id: '', name: '', floors: '' });
    const [editRack, setEditRack] = useState(null);

    const handleSubmitRack = async () => {
        if (editRack) {
            console.log(editRack)
            await updateRack(editRack.id, rackData, rackData.warehouse_id);
            setEditRack(null);
        } else {
            await createRack(rackData);
        }
        setRackData({ warehouse_id: '', name: '', floors: '' });
    };
    const handleCancelRack = () => {
        setEditRack(null);
        setRackData({ warehouse_id: '', name: '', floors: '' });
    };
    const handleEditRack = (rack, warehouseId) => {
        console.log('Начало редактирования стеллажа:', rack, 'warehouseId:', warehouseId);
        setEditRack({ ...rack, warehouse_id: warehouseId });
        setRackData({
            warehouse_id: warehouseId.toString(),
            name: rack.name,
            floors: rack.floors.toString()
        });
    };
    const handleDeleteRack = async (rackId, warehouseId) => {
        await deleteRack(rackId, warehouseId);
    };
    const handleSubmitCargo = async (cargoData) => {
        const cargo = await createCargo(cargoData.name);
        if (cargo) {
            await assignCargoToBin(parseInt(cargoData.bin_id), cargo.id, parseInt(cargoData.quantity));
        }
    };
    return (<div>
        <h1>Складской учет</h1>
        <ErrorMessage error={error} />
        <AddEditRackForm
            rackData={rackData}
            setRackData={setRackData}
            editRack={editRack}
            warehouses={structure}
            onSubmit={handleSubmitRack}
            onCancel={handleCancelRack}
        />
        <AddCargoForm
            structure={structure}
            onSubmit={handleSubmitCargo}
        />
        <CargoSearch
            onSearch={searchCargo}
            onDelete={deleteCargo}
            //onPlace={placeCargo}
        />
        <GenerateBinQR
            structure={structure}
            onGetQRUrl={getBinQRUrl}
        />
        <WarehouseStructure
            structure={structure}
            onEditRack={handleEditRack}
            onDeleteRack={handleDeleteRack}
        />
        <ForecastDisplay />
    </div>);
}
export default App;

/*
      <h1>Складской учет</h1>
      <ErrorMessage error={error} />
      <AddEditRackForm
        rackData={rackData}
        setRackData={setRackData}
        editRack={editRack}
        warehouses={structure}
        onSubmit={handleSubmitRack}
        onCancel={handleCancelRack}
      />
      <AddCargoForm
        structure={structure}
        onSubmit={handleSubmitCargo}
      />
      <CargoSearch
        onSearch={searchCargo}
        onDelete={deleteCargo}
        //onPlace={placeCargo}
      />
      <GenerateBinQR
        structure={structure}
        onGetQRUrl={getBinQRUrl}
      />
      <WarehouseStructure
        structure={structure}
        onEditRack={handleEditRack}
        onDeleteRack={handleDeleteRack}
      />

      function App() {
  const { structure, error, createRack, updateRack, deleteRack, deleteCargo, createCargo, assignCargoToBin, searchCargo, getBinQRUrl } = useWarehouseApi();
  const [rackData, setRackData] = useState({ warehouse_id: '', name: '', floors: '' });
  const [editRack, setEditRack] = useState(null);

  const handleSubmitRack = async () => {
    if (editRack) {
        console.log(editRack)
      await updateRack(editRack.id, rackData, rackData.warehouse_id);
      setEditRack(null);
    } else {
      await createRack(rackData);
    }
    setRackData({ warehouse_id: '', name: '', floors: '' });
  };

  const handleCancelRack = () => {
    setEditRack(null);
    setRackData({ warehouse_id: '', name: '', floors: '' });
  };

  const handleEditRack = (rack, warehouseId) => {
    console.log('Начало редактирования стеллажа:', rack, 'warehouseId:', warehouseId);
    setEditRack({ ...rack, warehouse_id: warehouseId });
    setRackData({
      warehouse_id: warehouseId.toString(),
      name: rack.name,
      floors: rack.floors.toString()
    });
  };

  const handleDeleteRack = async (rackId, warehouseId) => {
    await deleteRack(rackId, warehouseId);
  };

  const handleSubmitCargo = async (cargoData) => {
    const cargo = await createCargo(cargoData.name);
    if (cargo) {
      await assignCargoToBin(parseInt(cargoData.bin_id), cargo.id, parseInt(cargoData.quantity));
    }
  };

  return (
    <div className="container">
        hihih
    </div>
  );
}

export default App;


 */