
const { pool } = require('./utils/db');
const config = require('./config');

const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Crear tabla de spots
    await client.query(`
      CREATE TABLE IF NOT EXISTS spots (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );
    `);

    // Crear tabla de usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user' NOT NULL,
        reset_token VARCHAR(255),
        reset_token_expires BIGINT
      );
    `);

    // Crear tabla de reservas
    await client.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        spot_id INTEGER NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        UNIQUE(spot_id, date, start_time)
      );
    `);

    console.log('Tables created successfully.');

    // Insertar los nombres de los estacionamientos si no existen
    const spotNames = config.spotNames;
    for (const name of spotNames) {
        await client.query('INSERT INTO spots (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
    }
    console.log('Spots populated successfully.');

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
};

const init = async () => {
    try {
        await createTables();
        console.log('Database initialization complete.');
    } catch (err) {
        console.error('Failed to initialize the database.');
    } finally {
        await pool.end();
    }
};

init();
