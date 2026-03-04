/**
 * MongoDB seed script for the demo database.
 *
 * Creates sample time-series data and documents with various BSON types
 * to exercise all type conversions in the datasource plugin.
 */

// Switch to demo database.
const db = db.getSiblingDB('demo');

// Drop existing collections for idempotent seeding.
db.sensors.drop();
db.users.drop();
db.events.drop();
db.types_showcase.drop();

print('Seeding demo database...');

// --- Sensor readings (time-series data) ---
const sensorNames = ['temperature', 'humidity', 'pressure', 'wind_speed'];
const locations = ['building_a', 'building_b', 'outdoor'];
const now = new Date();
const readings = [];

for (let i = 0; i < 1000; i++) {
  const timestamp = new Date(now.getTime() - (1000 - i) * 60 * 1000); // 1 reading per minute
  const sensor = sensorNames[i % sensorNames.length];
  const location = locations[i % locations.length];

  let value;
  switch (sensor) {
    case 'temperature':
      value = 20 + Math.sin(i / 50) * 10 + Math.random() * 2;
      break;
    case 'humidity':
      value = 50 + Math.cos(i / 40) * 20 + Math.random() * 5;
      break;
    case 'pressure':
      value = 1013 + Math.sin(i / 100) * 10 + Math.random();
      break;
    case 'wind_speed':
      value = Math.abs(Math.sin(i / 30) * 15 + Math.random() * 3);
      break;
  }

  readings.push({
    timestamp: timestamp,
    sensor: sensor,
    location: location,
    value: Math.round(value * 100) / 100,
    unit: sensor === 'temperature' ? '°C' : sensor === 'humidity' ? '%' : sensor === 'pressure' ? 'hPa' : 'm/s',
    quality: Math.random() > 0.05 ? 'good' : 'suspect',
  });
}

db.sensors.insertMany(readings);
db.sensors.createIndex({ timestamp: 1 });
db.sensors.createIndex({ sensor: 1, timestamp: 1 });
print(`  Inserted ${readings.length} sensor readings`);

// --- Users (table data) ---
const users = [
  { name: 'Alice Chen', email: 'alice@example.com', role: 'admin', active: true, loginCount: 142, lastLogin: new Date('2024-06-15T10:30:00Z'), tags: ['engineering', 'lead'] },
  { name: 'Bob Smith', email: 'bob@example.com', role: 'editor', active: true, loginCount: 87, lastLogin: new Date('2024-06-14T14:20:00Z'), tags: ['marketing'] },
  { name: 'Carol Davis', email: 'carol@example.com', role: 'viewer', active: false, loginCount: 5, lastLogin: new Date('2024-03-01T09:00:00Z'), tags: [] },
  { name: 'Dave Wilson', email: 'dave@example.com', role: 'editor', active: true, loginCount: 203, lastLogin: new Date('2024-06-15T16:45:00Z'), tags: ['engineering', 'backend'] },
  { name: 'Eve Brown', email: 'eve@example.com', role: 'admin', active: true, loginCount: 310, lastLogin: new Date('2024-06-15T18:00:00Z'), tags: ['engineering', 'security'] },
];

db.users.insertMany(users);
print(`  Inserted ${users.length} users`);

// --- Events (mixed data with nested objects) ---
const eventTypes = ['page_view', 'click', 'api_call', 'error', 'login'];
const events = [];

for (let i = 0; i < 200; i++) {
  const timestamp = new Date(now.getTime() - (200 - i) * 30 * 1000); // 1 event per 30s
  const type = eventTypes[i % eventTypes.length];

  events.push({
    timestamp: timestamp,
    type: type,
    userId: `user_${(i % 5) + 1}`,
    metadata: {
      page: `/page/${i % 10}`,
      duration_ms: Math.floor(Math.random() * 5000),
      success: Math.random() > 0.1,
    },
    tags: [type, i % 2 === 0 ? 'even' : 'odd'],
    ip: `192.168.1.${(i % 254) + 1}`,
  });
}

db.events.insertMany(events);
db.events.createIndex({ timestamp: 1 });
print(`  Inserted ${events.length} events`);

// --- Types showcase (exercises all BSON types) ---
db.types_showcase.insertMany([
  {
    _id: ObjectId(),
    string_field: 'hello world',
    int32_field: NumberInt(42),
    int64_field: NumberLong(9999999999),
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
    int64_field: NumberLong(-9999999999),
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

print('Seed complete!');
