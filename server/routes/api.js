import express from 'express';
import racksRouter from './racks.js';
import cargoRouter from './cargo.js';
import binsRouter from './bins.js';
import forecastRouter from './forecast.js';

const router = express.Router();

// Логирование
router.use((req, res, next) => {
  console.log(`Получен запрос: ${req.method} ${req.originalUrl}`, req.body || req.query);
  next();
});

// Основные роутеры
router.use('/racks', racksRouter);
router.use('/cargo', cargoRouter);
router.use('/bin', binsRouter);
router.use('/forecast', forecastRouter);

// Специальные делегации
router.get('/structure', (req, res, next) => {
  console.log('Передача /structure → binsRouter');
  binsRouter.handle(req, res, next);
});

router.post('/bin_cargo', (req, res, next) => {
  console.log('Передача /bin_cargo → binsRouter');
  binsRouter.handle(req, res, next);
});

router.patch('/bin_cargo/increment', (req, res, next) => {
  console.log('Передача /bin_cargo/increment → binsRouter');
  binsRouter.handle(req, res, next);
});

// === ИСПРАВЛЕННЫЕ ДЕЛЕГАЦИИ ДЛЯ ТАБЛИЦ ===
router.get('/sensor/latest', (req, res, next) => {
  console.log('Передача /sensor/latest → binsRouter');
  binsRouter.handle(req, res, next);
});

router.get('/cargo/characteristics', (req, res, next) => {
  console.log('Передача /cargo/characteristics → binsRouter');
  binsRouter.handle(req, res, next);
});

export default router;