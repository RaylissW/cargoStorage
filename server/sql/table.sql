-- =============================================
-- ПОЛНАЯ СХЕМА БАЗЫ ДАННЫХ (дипломная работа)
-- =============================================

-- 1. Физическая структура склада
CREATE TABLE IF NOT EXISTS warehouse (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS rack (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    floors INTEGER NOT NULL CHECK (floors > 0),
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shelf (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rack_id INTEGER NOT NULL,
    level INTEGER NOT NULL CHECK (level > 0),
    UNIQUE (rack_id, level),
    FOREIGN KEY (rack_id) REFERENCES rack(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shelf_id INTEGER NOT NULL,
    cell_number INTEGER NOT NULL CHECK (cell_number > 0),
    width REAL NOT NULL CHECK (width > 0),
    height REAL NOT NULL CHECK (height > 0),
    depth REAL NOT NULL CHECK (depth > 0),
    max_volume REAL NOT NULL,
    current_volume REAL NOT NULL DEFAULT 0 CHECK (current_volume >= 0),
    temperature REAL,
    humidity REAL,
    pressure REAL,
    last_measurement TEXT,
    zone_id INTEGER,
    FOREIGN KEY (shelf_id) REFERENCES shelf(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES zone(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cargo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    width REAL NOT NULL CHECK (width > 0),
    height REAL NOT NULL CHECK (height > 0),
    depth REAL NOT NULL CHECK (depth > 0),
    volume REAL NOT NULL,
    weight_per_unit REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bin_cargo (
    bin_id INTEGER NOT NULL,
    cargo_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    removal_date TEXT,
    PRIMARY KEY (bin_id, cargo_id),
    FOREIGN KEY (bin_id) REFERENCES bin(id) ON DELETE CASCADE,
    FOREIGN KEY (cargo_id) REFERENCES cargo(id) ON DELETE CASCADE
);

-- 2. Модуль IoT
CREATE TABLE IF NOT EXISTS zone (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    warehouse_id INTEGER NOT NULL,
    description TEXT,
    default_temp_min REAL,
    default_temp_max REAL,
    default_humidity_min REAL,
    default_humidity_max REAL,
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sensor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bin_id INTEGER,
    sensor_type TEXT NOT NULL,
    mqtt_topic TEXT UNIQUE,
    last_seen TEXT,
    FOREIGN KEY (bin_id) REFERENCES bin(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sensor_reading (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id INTEGER NOT NULL,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    temperature REAL,
    humidity REAL,
    pressure REAL,
    FOREIGN KEY (sensor_id) REFERENCES sensor(id) ON DELETE CASCADE
);

-- 3. Модуль принятия решений
CREATE TABLE IF NOT EXISTS product_characteristics (
    cargo_id INTEGER PRIMARY KEY,
    temp_min REAL,
    temp_max REAL,
    humidity_min REAL,
    humidity_max REAL,
    compatibility_group TEXT,
    is_hazardous BOOLEAN DEFAULT FALSE,
    is_fragile BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (cargo_id) REFERENCES cargo(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS placement_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cargo_id INTEGER,
    bin_id INTEGER,
    action TEXT NOT NULL CHECK (action IN ('placed', 'removed', 'moved')),
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    FOREIGN KEY (cargo_id) REFERENCES cargo(id),
    FOREIGN KEY (bin_id) REFERENCES bin(id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_cargo_name ON cargo(name);
CREATE INDEX IF NOT EXISTS idx_bin_cargo ON bin_cargo(bin_id, cargo_id);
CREATE INDEX IF NOT EXISTS idx_sensor_reading ON sensor_reading(sensor_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_placement_log ON placement_log(cargo_id, timestamp);

PRAGMA foreign_keys = ON;