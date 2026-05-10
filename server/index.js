import express from 'express';
import cors from 'cors';
import { db } from './db/init.js';
import apiRoutes from './routes/api.js';

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  console.log('Получен запрос на /');
  res.send('Warehouse API');
});

app.get('/api/test', (req, res) => {
  console.log('Получен тестовый запрос GET /api/test');
  res.json({ message: 'Тестовый эндпоинт работает!' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err.stack);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const server = app.listen(3000, () => {
  console.log('Server running on port 3000');
});

process.on('SIGINT', () => {
  console.log('Завершение работы сервера');
  server.close(() => {
    db.close((err) => {
      if (err) console.error('Ошибка закрытия базы данных:', err.message);
      console.log('База данных закрыта');
      process.exit(0);
    });
  });
});

process.on('uncaughtException', (err) => {
  console.error('Непойманная ошибка:', err);
});