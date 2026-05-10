import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

const TOKEN = '7987270087:AAEiHlwUdZhg59zKL45cezAgdMNIA410EYc';
const API_URL = 'http://localhost:3000/api';

const bot = new TelegramBot(TOKEN, { polling: true });

const userState = {};

async function getStructure() {
  try {
    const { data } = await axios.get(`${API_URL}/structure`);
return data;
} catch (err) {
  console.error('Ошибка получения структуры:', err.message);
  return [];
}
}

function getBinOptions(structure) {
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
  return binOptions;
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Добро пожаловать в складской бот!\nДоступные команды:\n/add_rack - Добавить стеллаж\n/edit_rack - Редактировать стеллаж\n/delete_rack - Удалить стеллаж\n/add_cargo - Добавить груз\n/search_cargo - Поиск груза\n/generate_qr - Сгенерировать QR-код для ячейки`);
});

bot.onText(/\/add_rack/, async (msg) => {
  const chatId = msg.chat.id;
  const structure = await getStructure();
  if (structure.length === 0) {
    return bot.sendMessage(chatId, 'Нет доступных складов.');
  }
  const warehouseOptions = structure.map(w => `${w.id}: ${w.name}`).join('\n');
  bot.sendMessage(chatId, `Выберите ID склада:\n${warehouseOptions}`);
  userState[chatId] = { action: 'add_rack', step: 'warehouse_id' };
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!userState[chatId] || text.startsWith('/')) return;

  const state = userState[chatId];

  if (state.action === 'add_rack') {
    if (state.step === 'warehouse_id') {
      state.warehouse_id = parseInt(text);
      bot.sendMessage(chatId, 'Введите название стеллажа (например, Стеллаж А):');
      state.step = 'name';
    } else if (state.step === 'name') {
      state.name = text;
      bot.sendMessage(chatId, 'Введите количество этажей (например, 3):');
      state.step = 'floors';
    } else if (state.step === 'floors') {
      const floors = parseInt(text);
      if (isNaN(floors) || floors <= 0) {
        return bot.sendMessage(chatId, 'Введите корректное число этажей (> 0).');
      }
      try {
        const { data } = await axios.post(`${API_URL}/racks`, {
          warehouse_id: state.warehouse_id,
          name: state.name,
          floors
        });
        bot.sendMessage(chatId, `Стеллаж "${data.name}" добавлен!`);
      } catch (err) {
        bot.sendMessage(chatId, `Ошибка: ${err.response?.data?.error || err.message}`);
      }
      delete userState[chatId];
    }
  }

  // Редактирование стеллажа
  if (state.action === 'edit_rack') {
    if (state.step === 'rack_id') {
      state.rack_id = parseInt(text);
      bot.sendMessage(chatId, 'Введите новое название стеллажа:');
      state.step = 'name';
    } else if (state.step === 'name') {
      state.name = text;
      bot.sendMessage(chatId, 'Введите новое количество этажей:');
      state.step = 'floors';
    } else if (state.step === 'floors') {
      const floors = parseInt(text);
      if (isNaN(floors) || floors <= 0) {
        return bot.sendMessage(chatId, 'Введите корректное число этажей (> 0).');
      }
      try {
        const { data } = await axios.put(`${API_URL}/racks/${state.rack_id}`, {
          name: state.name,
          floors
        });
        bot.sendMessage(chatId, `Стеллаж "${data.name}" обновлен!`);
      } catch (err) {
        bot.sendMessage(chatId, `Ошибка: ${err.response?.data?.error || err.message}`);
      }
      delete userState[chatId];
    }
  }

  // Удаление стеллажа
  if (state.action === 'delete_rack') {
    const rack_id = parseInt(text);
    try {
      await axios.delete(`${API_URL}/racks/${rack_id}`);
      bot.sendMessage(chatId, 'Стеллаж удален!');
    } catch (err) {
      bot.sendMessage(chatId, `Ошибка: ${err.response?.data?.error || err.message}`);
    }
    delete userState[chatId];
  }

  if (state.action === 'add_cargo') {
    if (state.step === 'name') {
      state.name = text;
      const structure = await getStructure();
      const binOptions = getBinOptions(structure);
      if (binOptions.length === 0) {
        delete userState[chatId];
        return bot.sendMessage(chatId, 'Нет доступных ячеек.');
      }
      const optionsText = binOptions.map((opt, i) => `${i + 1}: ${opt.label}`).join('\n');
      bot.sendMessage(chatId, `Выберите номер ячейки:\n${optionsText}`);
      state.step = 'bin_id';
      state.binOptions = binOptions;
    } else if (state.step === 'bin_id') {
      const index = parseInt(text) - 1;
      if (isNaN(index) || index < 0 || index >= state.binOptions.length) {
        return bot.sendMessage(chatId, 'Введите корректный номер ячейки.');
      }
      state.bin_id = state.binOptions[index].bin_id;
      bot.sendMessage(chatId, 'Введите количество (например, 10):');
      state.step = 'quantity';
    } else if (state.step === 'quantity') {
      const quantity = parseInt(text);
      if (isNaN(quantity) || quantity <= 0) {
        return bot.sendMessage(chatId, 'Введите корректное количество (> 0).');
      }
      try {
        const { data: cargo } = await axios.post(`${API_URL}/cargo`, { name: state.name });
        await axios.post(`${API_URL}/bin_cargo`, {
          bin_id: state.bin_id,
          cargo_id: cargo.id,
          quantity
        });
        bot.sendMessage(chatId, `Груз "${state.name}" добавлен в ячейку!`);
      } catch (err) {
        bot.sendMessage(chatId, `Ошибка: ${err.response?.data?.error || err.message}`);
      }
      delete userState[chatId];
    }
  }

  // Поиск груза
  if (state.action === 'search_cargo') {
    try {
      const { data } = await axios.get(`${API_URL}/cargo/search?name=${encodeURIComponent(text)}`);
      if (data.length === 0) {
        bot.sendMessage(chatId, 'Поиск не дал результатов.');
      } else {
        const results = data.map(cargo => {
          const locations = cargo.locations.map(loc =>
            `${cargo.name}, Склад: ${loc.warehouse.name}, Стеллаж: ${loc.rack.name}, Этаж: ${loc.shelf.level}, Ячейка: ${loc.bin.cell_number} (Количество: ${loc.quantity})`
          ).join('\n');
          return locations;
        }).join('\n\n');
        bot.sendMessage(chatId, `Результаты поиска:\n${results}`);
      }
    } catch (err) {
      bot.sendMessage(chatId, `Ошибка: ${err.response?.data?.error || err.message}`);
    }
    delete userState[chatId];
  }

  // Генерация QR-кода
  if (state.action === 'generate_qr') {
    const structure = await getStructure();
    const binOptions = getBinOptions(structure);
    if (binOptions.length === 0) {
      delete userState[chatId];
      return bot.sendMessage(chatId, 'Нет доступных ячеек.');
    }
    const index = parseInt(text) - 1;
    if (isNaN(index) || index < 0 || index >= binOptions.length) {
      return bot.sendMessage(chatId, 'Введите корректный номер ячейки.');
    }
    const bin_id = binOptions[index].bin_id;
    try {
      // Получаем изображение QR
      const qrImageResponse = await axios.get(`${API_URL}/bin/${bin_id}/qr-image`, { responseType: 'arraybuffer' });
      const qrLink = `${API_URL}/bin/${bin_id}/qr`;

      // Отправляем изображение и ссылку
      await bot.sendPhoto(chatId, Buffer.from(qrImageResponse.data), {
        caption: `QR-код для ячейки: ${binOptions[index].label}\nСсылка: ${qrLink}`
      });
    } catch (err) {
      console.error('Ошибка генерации QR:', err.message);
      bot.sendMessage(chatId, `Ошибка: ${err.response?.data?.error || err.message}`);
    }
    delete userState[chatId];
  }
});

// Команда /edit_rack
bot.onText(/\/edit_rack/, async (msg) => {
  const chatId = msg.chat.id;
  const structure = await getStructure();
  const rackOptions = [];
  structure.forEach(w => {
    w.racks.forEach(r => {
      rackOptions.push(`${r.id}: ${r.name} (Склад ${w.name})`);
    });
  });
  if (rackOptions.length === 0) {
    return bot.sendMessage(chatId, 'Нет доступных стеллажей.');
  }
  bot.sendMessage(chatId, `Выберите ID стеллажа:\n${rackOptions.join('\n')}`);
  userState[chatId] = { action: 'edit_rack', step: 'rack_id' };
});

// Команда /delete_rack
bot.onText(/\/delete_rack/, async (msg) => {
  const chatId = msg.chat.id;
  const structure = await getStructure();
  const rackOptions = [];
  structure.forEach(w => {
    w.racks.forEach(r => {
      rackOptions.push(`${r.id}: ${r.name} (Склад ${w.name})`);
    });
  });
  if (rackOptions.length === 0) {
    return bot.sendMessage(chatId, 'Нет доступных стеллажей.');
  }
  bot.sendMessage(chatId, `Выберите ID стеллажа для удаления:\n${rackOptions.join('\n')}`);
  userState[chatId] = { action: 'delete_rack', step: 'rack_id' };
});

// Команда /add_cargo
bot.onText(/\/add_cargo/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Введите название груза:');
  userState[chatId] = { action: 'add_cargo', step: 'name' };
});

// Команда /search_cargo
bot.onText(/\/search_cargo/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Введите часть названия груза:');
  userState[chatId] = { action: 'search_cargo', step: 'name' };
});

// Команда /generate_qr
bot.onText(/\/generate_qr/, async (msg) => {
  const chatId = msg.chat.id;
  const structure = await getStructure();
  const binOptions = getBinOptions(structure);
  if (binOptions.length === 0) {
    return bot.sendMessage(chatId, 'Нет доступных ячеек.');
  }
  const optionsText = binOptions.map((opt, i) => `${i + 1}: ${opt.label}`).join('\n');
  bot.sendMessage(chatId, `Выберите номер ячейки:\n${optionsText}`);
  userState[chatId] = { action: 'generate_qr', step: 'bin_id' };
});

console.log('Бот запущен...');
