import express from 'express';
import racksRouter from './racks.js';
import cargoRouter from './cargo.js';
import binsRouter from './bins.js';
import forecastRouter from './forecast.js';


const router = express.Router();

// Логируем все входящие запросы
router.use((req, res, next) => {
  console.log(`Получен запрос: ${req.method} ${req.originalUrl}`, req.body || req.query);
  next();
});

// Подключаем маршруты
router.use('/racks', racksRouter);
router.use('/cargo', cargoRouter);
router.use('/bin', binsRouter);
router.use('/forecast', forecastRouter);

// Явно добавляем маршрут /structure из bins.js
router.get('/structure', (req, res, next) => {
  console.log('Передача запроса /structure в binsRouter');
  binsRouter.handle(req, res, next); // Передаем запрос в binsRouter
});

// Добавляем маршрут для привязки груза к ячейке
router.post('/bin_cargo', (req, res, next) => {
  console.log('Передача запроса /bin_cargo в binsRouter');
  binsRouter.handle(req, res, next); // Передаем запрос в binsRouter
});

export default router;