/**
 * MongoDB seed script for the demo database.
 *
 * Creates sample time-series data and documents with various BSON types
 * to exercise all type conversions in the datasource plugin.
 *
 * Uses a seeded PRNG for reproducible randomness across container restarts.
 */

// Simple mulberry32 PRNG — deterministic given a seed.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

/** Pick a random element from an array. */
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

/** Random integer in [min, max]. */
function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** Random float in [min, max]. */
function randFloat(min, max) {
  return min + rand() * (max - min);
}

// Switch to demo database.
const db = db.getSiblingDB('demo');

// Drop existing collections for idempotent seeding.
db.sensors.drop();
db.users.drop();
db.events.drop();
db.types_showcase.drop();
db.orders.drop();

print('Seeding demo database...');

const now = new Date();

// ---------------------------------------------------------------------------
// Sensor readings — 90 days of data, ~10,000 readings
// ---------------------------------------------------------------------------
const sensorNames = ['temperature', 'humidity', 'pressure', 'wind_speed'];
const locations = ['building_a', 'building_b', 'outdoor'];
const SENSOR_DAYS = 90;
const SENSOR_COUNT = 10000;
const sensorSpanMs = SENSOR_DAYS * 24 * 60 * 60 * 1000;
const readings = [];

for (let i = 0; i < SENSOR_COUNT; i++) {
  // Spread readings across the full 90 days with jitter.
  const baseOffset = (i / SENSOR_COUNT) * sensorSpanMs;
  const jitter = randFloat(-300000, 300000); // ±5 min jitter
  const timestamp = new Date(now.getTime() - sensorSpanMs + baseOffset + jitter);

  const sensor = pick(sensorNames);
  const location = pick(locations);

  // Day-of-year for seasonal patterns, hour for diurnal patterns.
  const dayOfYear = Math.floor((timestamp.getTime() - new Date(timestamp.getFullYear(), 0, 1).getTime()) / 86400000);
  const hour = timestamp.getHours();

  let value;
  switch (sensor) {
    case 'temperature':
      // Seasonal swing + diurnal cycle + noise.
      value = 18 + Math.sin((dayOfYear / 365) * 2 * Math.PI) * 8
        + Math.sin((hour / 24) * 2 * Math.PI - 1.5) * 4
        + randFloat(-2, 2);
      break;
    case 'humidity':
      // Inverse of temperature pattern + noise.
      value = 55 - Math.sin((dayOfYear / 365) * 2 * Math.PI) * 15
        - Math.sin((hour / 24) * 2 * Math.PI - 1.5) * 8
        + randFloat(-5, 5);
      value = Math.max(10, Math.min(98, value));
      break;
    case 'pressure':
      // Slow drift + weather fronts (random walks).
      value = 1013 + Math.sin((dayOfYear / 30) * 2 * Math.PI) * 8
        + Math.sin(i / 200) * 5
        + randFloat(-2, 2);
      break;
    case 'wind_speed':
      // Always positive, gusty.
      value = Math.abs(
        6 + Math.sin((hour / 24) * 2 * Math.PI) * 4
        + randFloat(0, 8)
      );
      break;
  }

  readings.push({
    timestamp: timestamp,
    sensor: sensor,
    location: location,
    value: Math.round(value * 100) / 100,
    unit: sensor === 'temperature' ? '°C' : sensor === 'humidity' ? '%' : sensor === 'pressure' ? 'hPa' : 'm/s',
    quality: rand() > 0.05 ? 'good' : 'suspect',
  });
}

db.sensors.insertMany(readings);
db.sensors.createIndex({ timestamp: 1 });
db.sensors.createIndex({ sensor: 1, timestamp: 1 });
print(`  Inserted ${readings.length} sensor readings (${SENSOR_DAYS} days)`);

// ---------------------------------------------------------------------------
// Users — static table data (kept stable for E2E assertions)
// ---------------------------------------------------------------------------
const users = [
  { name: 'Alice Chen', email: 'alice@example.com', role: 'admin', active: true, loginCount: 142, lastLogin: new Date('2024-06-15T10:30:00Z'), tags: ['engineering', 'lead'] },
  { name: 'Bob Smith', email: 'bob@example.com', role: 'editor', active: true, loginCount: 87, lastLogin: new Date('2024-06-14T14:20:00Z'), tags: ['marketing'] },
  { name: 'Carol Davis', email: 'carol@example.com', role: 'viewer', active: false, loginCount: 5, lastLogin: new Date('2024-03-01T09:00:00Z'), tags: [] },
  { name: 'Dave Wilson', email: 'dave@example.com', role: 'editor', active: true, loginCount: 203, lastLogin: new Date('2024-06-15T16:45:00Z'), tags: ['engineering', 'backend'] },
  { name: 'Eve Brown', email: 'eve@example.com', role: 'admin', active: true, loginCount: 310, lastLogin: new Date('2024-06-15T18:00:00Z'), tags: ['engineering', 'security'] },
  { name: 'Frank Lee', email: 'frank@example.com', role: 'viewer', active: true, loginCount: 42, lastLogin: new Date('2024-05-20T11:00:00Z'), tags: ['design'] },
  { name: 'Grace Kim', email: 'grace@example.com', role: 'editor', active: true, loginCount: 156, lastLogin: new Date('2024-06-10T09:15:00Z'), tags: ['engineering', 'frontend'] },
  { name: 'Hank Patel', email: 'hank@example.com', role: 'viewer', active: false, loginCount: 2, lastLogin: new Date('2024-01-15T08:30:00Z'), tags: [] },
];

db.users.insertMany(users);
print(`  Inserted ${users.length} users`);

// ---------------------------------------------------------------------------
// Events — 30 days of data, 2,000 events
// ---------------------------------------------------------------------------
const eventTypes = ['page_view', 'click', 'api_call', 'error', 'login'];
const eventPages = ['/dashboard', '/settings', '/profile', '/reports', '/admin', '/search', '/home', '/api/docs', '/billing', '/support'];
const eventUsers = ['user_1', 'user_2', 'user_3', 'user_4', 'user_5', 'user_6', 'user_7', 'user_8'];
const EVENT_DAYS = 30;
const EVENT_COUNT = 2000;
const eventSpanMs = EVENT_DAYS * 24 * 60 * 60 * 1000;
const events = [];

for (let i = 0; i < EVENT_COUNT; i++) {
  const baseOffset = (i / EVENT_COUNT) * eventSpanMs;
  const jitter = randFloat(-60000, 60000); // ±1 min jitter
  const timestamp = new Date(now.getTime() - eventSpanMs + baseOffset + jitter);

  const type = pick(eventTypes);
  const userId = pick(eventUsers);

  // Errors are less frequent during business hours.
  const hour = timestamp.getHours();
  const successRate = type === 'error' ? 0 : (hour >= 9 && hour <= 17 ? 0.95 : 0.85);

  events.push({
    timestamp: timestamp,
    type: type,
    userId: userId,
    metadata: {
      page: pick(eventPages),
      duration_ms: randInt(10, type === 'page_view' ? 12000 : 5000),
      success: rand() < successRate,
      browser: pick(['Chrome', 'Firefox', 'Safari', 'Edge']),
    },
    tags: [type, rand() > 0.5 ? 'mobile' : 'desktop'],
    ip: `192.168.${randInt(1, 10)}.${randInt(1, 254)}`,
  });
}

db.events.insertMany(events);
db.events.createIndex({ timestamp: 1 });
db.events.createIndex({ type: 1, timestamp: 1 });
print(`  Inserted ${events.length} events (${EVENT_DAYS} days)`);

// ---------------------------------------------------------------------------
// Types showcase — exercises all BSON types (unchanged)
// ---------------------------------------------------------------------------
db.types_showcase.insertMany([
  {
    _id: ObjectId(),
    string_field: 'hello world',
    int32_field: NumberInt(42),
    int64_field: NumberLong('9999999999'),
    double_field: 3.14159,
    decimal128_field: NumberDecimal('12345.6789012345'),
    boolean_true: true,
    boolean_false: false,
    date_field: new Date('2024-06-15T12:00:00Z'),
    timestamp_field: Timestamp(1718452800, 1),
    null_field: null,
    array_field: [1, 'two', true, null],
    embedded_doc: { nested_key: 'nested_value', nested_num: 42 },
    binary_field: BinData(0, 'SGVsbG8gV29ybGQ='),
    regex_field: /pattern/i,
    min_key: MinKey(),
    max_key: MaxKey(),
  },
  {
    _id: ObjectId(),
    string_field: 'second document',
    int32_field: NumberInt(-100),
    int64_field: NumberLong('-9999999999'),
    double_field: -0.001,
    decimal128_field: NumberDecimal('0.0000000001'),
    boolean_true: false,
    boolean_false: true,
    date_field: new Date('2023-01-01T00:00:00Z'),
    null_field: null,
    array_field: [],
    embedded_doc: { deeply: { nested: { value: true } } },
  },
]);
print('  Inserted 2 types_showcase documents');

// ---------------------------------------------------------------------------
// Orders — 180 days of data, 5,000 orders
// ---------------------------------------------------------------------------
const products = [
  { name: 'Laptop', category: 'electronics', basePrice: 999 },
  { name: 'Headphones', category: 'electronics', basePrice: 79 },
  { name: 'Keyboard', category: 'electronics', basePrice: 49 },
  { name: 'Monitor', category: 'electronics', basePrice: 349 },
  { name: 'T-Shirt', category: 'clothing', basePrice: 25 },
  { name: 'Jeans', category: 'clothing', basePrice: 60 },
  { name: 'Jacket', category: 'clothing', basePrice: 120 },
  { name: 'Sneakers', category: 'clothing', basePrice: 89 },
  { name: 'Coffee Beans', category: 'food', basePrice: 15 },
  { name: 'Olive Oil', category: 'food', basePrice: 12 },
  { name: 'Chocolate', category: 'food', basePrice: 8 },
  { name: 'Pasta', category: 'food', basePrice: 5 },
  { name: 'Novel', category: 'books', basePrice: 14 },
  { name: 'Cookbook', category: 'books', basePrice: 22 },
  { name: 'Textbook', category: 'books', basePrice: 65 },
  { name: 'Comic Book', category: 'books', basePrice: 10 },
];
const regions = ['north', 'south', 'east', 'west'];
const statuses = ['completed', 'completed', 'completed', 'pending', 'cancelled']; // weighted
const customers = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivy', 'Jack',
  'Karen', 'Leo', 'Mia', 'Noah', 'Olivia'];
const ORDER_DAYS = 180;
const ORDER_COUNT = 5000;
const orderSpanMs = ORDER_DAYS * 24 * 60 * 60 * 1000;
const orders = [];

for (let i = 0; i < ORDER_COUNT; i++) {
  const baseOffset = (i / ORDER_COUNT) * orderSpanMs;
  const jitter = randFloat(-600000, 600000); // ±10 min jitter
  const timestamp = new Date(now.getTime() - orderSpanMs + baseOffset + jitter);

  const product = pick(products);
  const quantity = randInt(1, 5);
  // Price varies by ±15% to simulate discounts/markups.
  const amount = Math.round(product.basePrice * quantity * randFloat(0.85, 1.15) * 100) / 100;

  orders.push({
    timestamp: timestamp,
    product: product.name,
    category: product.category,
    amount: amount,
    quantity: quantity,
    region: pick(regions),
    status: pick(statuses),
    customer: pick(customers),
  });
}

db.orders.insertMany(orders);
db.orders.createIndex({ timestamp: 1 });
db.orders.createIndex({ category: 1 });
db.orders.createIndex({ customer: 1 });
print(`  Inserted ${orders.length} orders (${ORDER_DAYS} days)`);

// ---------------------------------------------------------------------------
// Auth users — for E2E testing of auth mechanisms
// ---------------------------------------------------------------------------
const adminDb = db.getSiblingDB('admin');

// SCRAM-SHA-256 user
try { adminDb.dropUser('scramUser256'); } catch { /* ignore if not exists */ }
adminDb.createUser({
  user: 'scramUser256',
  pwd: 'testpass256',
  roles: [
    { role: 'readWrite', db: 'demo' },
    { role: 'read', db: 'admin' },
  ],
  mechanisms: ['SCRAM-SHA-256'],
});
print('  Created SCRAM-SHA-256 user: scramUser256');

// SCRAM-SHA-1 user
try { adminDb.dropUser('scramUser1'); } catch { /* ignore if not exists */ }
adminDb.createUser({
  user: 'scramUser1',
  pwd: 'testpass1',
  roles: [
    { role: 'readWrite', db: 'demo' },
    { role: 'read', db: 'admin' },
  ],
  mechanisms: ['SCRAM-SHA-1'],
});
print('  Created SCRAM-SHA-1 user: scramUser1');

// X.509 user — subject in RFC 2253 format (reversed from OpenSSL's default order).
const externalDb = db.getSiblingDB('$external');
const x509User = 'O=TestOrg,CN=mongodb-client';
try { externalDb.dropUser(x509User); } catch { /* ignore if not exists */ }
externalDb.createUser({
  user: x509User,
  roles: [
    { role: 'readWrite', db: 'demo' },
    { role: 'read', db: 'admin' },
  ],
});
print('  Created X.509 user: ' + x509User);

print('Seed complete!');
