import React, { useState } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';

const GenerateBinQR = ({ structure, onGetQRUrl }) => {
  const [selectedBinId, setSelectedBinId] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState(''); // URL изображения QR
  const [qrLinkUrl, setQrLinkUrl] = useState('');   // Ссылка на HTML

  // Формируем список ячеек для выпадающего меню
  const binOptions = [];
  structure.forEach(warehouse => {
    warehouse.racks.forEach(rack => {
      rack.shelves.forEach(shelf => {
        shelf.bins.forEach(bin => {
          binOptions.push({
            bin_id: bin.id,
            label: `Склад ${warehouse.name}, Стеллаж ${rack.name}, Этаж ${shelf.level}, Ячейка ${bin.cell_number}`
          });
        });
      });
    });
  });

  const handleGenerateQR = async () => {
    if (!selectedBinId) return;
    // Получаем URL изображения QR
    const imageUrl = await onGetQRUrl(selectedBinId, 'image');
    setQrImageUrl(imageUrl);
    // Получаем ссылку на HTML
    const linkUrl = await onGetQRUrl(selectedBinId, 'link');
    setQrLinkUrl(linkUrl);
  };

  return (
    <div className="generate-qr">
      <h2>Генерация QR-кода для ячейки</h2>
      <select
        value={selectedBinId}
        onChange={(e) => setSelectedBinId(e.target.value)}
      >
        <option value="">Выберите ячейку</option>
        {binOptions.map(option => (
          <option key={option.bin_id} value={option.bin_id}>
            {option.label}
          </option>
        ))}
      </select>
      <button onClick={handleGenerateQR} disabled={!selectedBinId}>
        Сгенерировать QR-код
      </button>
      {qrImageUrl && qrLinkUrl && (
        <div className="qr-code">
          <h3>QR-код для ячейки</h3>
          <QRCode value={qrLinkUrl} size={256} />
          <p>Сканируйте код для просмотра содержимого ячейки</p>
          <a href={qrImageUrl} download={`qr-bin-${selectedBinId}.png`}>Скачать QR-код</a>
          <p>Ссылка на ячейку: <a href={qrLinkUrl} target="_blank" rel="noopener noreferrer">{qrLinkUrl}</a></p>
        </div>
      )}
    </div>
  );
};

export default GenerateBinQR;
