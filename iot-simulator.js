import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:3000/api/bin/AddMeasure';

// 4 датчика с разными "зонами"
const sensors = [
    {
        id: 40,
        name: "Склад 1 - Обычная зона",
        tempMin: 18, tempMax: 26,
        humMin: 35,  humMax: 65,
        isFreezer: false
    },
    {
        id: 41,
        name: "Склад 1 - Морозильная зона (лёгкое охлаждение)",
        tempMin: 8,  tempMax: 14,
        humMin: 30,  humMax: 55,
        isFreezer: true
    },
    {
        id: 42,
        name: "Склад 2 - Обычная зона",
        tempMin: 19, tempMax: 27,
        humMin: 40,  humMax: 70,
        isFreezer: false
    },
    {
        id: 43,
        name: "Склад 2 - Радиодетали (чувствительная зона)",
        tempMin: 17, tempMax: 24,
        humMin: 25,  humMax: 50,
        isFreezer: false
    }
];

function randomInRange(min, max) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(1));
}

function getExtremeValue(baseMin, baseMax) {
    // С вероятностью ~8% — резкое отклонение
    if (Math.random() < 0.08) {
        const isCold = Math.random() < 0.5;
        return isCold
            ? baseMin - randomInRange(5, 12)   // резкое похолодание
            : baseMax + randomInRange(5, 12);  // резкий перегрев
    }
    return randomInRange(baseMin, baseMax);
}

async function sendSensorData(sensor) {
    const temp = getExtremeValue(sensor.tempMin, sensor.tempMax);
    const hum  = randomInRange(sensor.humMin, sensor.humMax);
    const press = randomInRange(740, 780); // давление почти всегда нормально

    const params = new URLSearchParams({
        sens: sensor.id,
        temp: temp.toFixed(1),
        hum: hum.toFixed(1),
        press: press.toFixed(0),
        tS: (temp + (Math.random() * 0.8 - 0.4)).toFixed(1),   // smoothed
        hS: (hum + (Math.random() * 1.2 - 0.6)).toFixed(1),
        pS: press.toFixed(0),
        time: Date.now()
    });

    const url = `${SERVER_URL}?${params.toString()}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log(`📡 [${sensor.name}] → temp=${temp}°C, hum=${hum}%, press=${press} мм рт.ст. | ${data.message || 'OK'}`);
    } catch (err) {
        console.error(`❌ Ошибка отправки от датчика ${sensor.id}:`, err.message);
    }
}

async function simulate() {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 IoT-СИМУЛЯТОР ЗАПУЩЕН (4 датчика, каждые 5 минут)');
    console.log('=' .repeat(70));

    setInterval(async () => {
        console.log(`\n⏰ ${new Date().toLocaleTimeString('ru-RU')} — отправка показаний...`);
        for (const sensor of sensors) {
            await sendSensorData(sensor);
            await new Promise(r => setTimeout(r, 800)); // небольшая задержка между датчиками
        }
    }, 5 * 60 * 1000); // каждые 5 минут

    // Первая отправка сразу
    console.log('📤 Первая отправка данных...');
    for (const sensor of sensors) {
        await sendSensorData(sensor);
        await new Promise(r => setTimeout(r, 800));
    }
}

simulate();