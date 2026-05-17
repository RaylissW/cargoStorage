import express from 'express';
import cors from 'cors';
import { db } from './db/init.js';
import apiRoutes from './routes/api.js';

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use('/api', apiRoutes);

// Простой тестовый маршрут
app.get('/', (req, res) => res.send('Warehouse API работает'));

// Автоматический запуск прогноза при старте сервера
const runForecastOnStartup = async () => {
  console.log('🚀 Запуск прогнозирования спроса при старте сервера...');
  try {
    const response = await fetch('http://localhost:3000/api/forecast/all');
    if (response.ok) {
      console.log('✅ Прогноз успешно выполнен и сохранён в БД при старте сервера');
    } else {
      console.error('⚠️ Прогноз вернул ошибку при старте');
    }
  } catch (err) {
    console.error('❌ Не удалось выполнить прогноз при старте сервера:', err.message);
  }
};

// Запускаем сервер
const server = app.listen(3000, async () => {
  console.log('Server running on port 3000');
  console.log('✅ Подключено к базе данных SQLite');

  // Запускаем прогноз после старта сервера (не блокируем запуск)
  setTimeout(runForecastOnStartup, 2000); // небольшая задержка, чтобы сервер полностью поднялся
});

process.on('SIGINT', () => {
  console.log('Завершение работы сервера');
  server.close(() => {
    db.close(() => {
      console.log('База данных закрыта');
      process.exit(0);
    });
  });
});