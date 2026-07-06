import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_NAME = process.env.DB_NAME || 'laundry_connect';

async function setupDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    console.log(`Creating database "${DB_NAME}" if it does not exist...`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${DB_NAME}\``);

    const schemaPath = path.join(__dirname, '..', 'database_schema.sql');
    let sql = fs.readFileSync(schemaPath, 'utf8');

    // Remove CREATE DATABASE / USE lines — already handled above
    sql = sql
      .replace(/CREATE DATABASE IF NOT EXISTS[\s\S]*?;/i, '')
      .replace(/USE\s+\w+\s*;/i, '');

    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('--'));

    for (const statement of statements) {
      await connection.query(statement);
    }

    const [tables] = await connection.query('SHOW TABLES');
    console.log(`Database "${DB_NAME}" is ready. Tables: ${tables.length}`);
    tables.forEach((row) => console.log('  -', Object.values(row)[0]));
  } finally {
    await connection.end();
  }
}

setupDatabase().catch((error) => {
  console.error('Database setup failed:', error.message);
  process.exit(1);
});
