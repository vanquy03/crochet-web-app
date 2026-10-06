import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { products as sampleProducts } from '../src/js/data/sample-products.js';

export const defaultSettings = {
  name: 'Tiệm Len',
  zaloPhone: '',
  facebookUrl: '',
  email: '',
  phone: '',
  demo: true,
  shippingFee: 30000,
  freeShippingThreshold: 500000,
};
export function openDatabase(filename) {
  if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 3) throw new Error('Database version is newer than this application.');
  if (version === 0) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(
        readFileSync(new URL('./migrations/001-initial.sql', import.meta.url), 'utf8').replace(
          /^\uFEFF/,
          '',
        ),
      );
      const insert = db.prepare(
        'INSERT INTO products(id,name,type,description,price,stock,color,background,tag) VALUES(?,?,?,?,?,0,?,?,?)',
      );
      for (const p of sampleProducts)
        insert.run(p.id, p.name, p.type, p.desc, p.price, p.color, p.bg, p.tag);
      db.prepare('INSERT INTO settings(id,data) VALUES(1,?)').run(JSON.stringify(defaultSettings));
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      db.close();
      throw error;
    }
  }
  if (version < 2) {
    try {
      transaction(db, () =>
        db.exec(readFileSync(new URL('./migrations/002-customers.sql', import.meta.url), 'utf8')),
      );
    } catch (error) {
      db.close();
      throw error;
    }
  }
  if (version < 3)
    transaction(db, () =>
      db.exec(readFileSync(new URL('./migrations/003-community.sql', import.meta.url), 'utf8')),
    );
  return db;
}
export function transaction(db, operation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
export function getSettings(db) {
  return JSON.parse(db.prepare('SELECT data FROM settings WHERE id=1').get().data);
}
export function publicProduct(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    kind: row.kind,
    desc: row.description,
    price: row.price,
    stock: row.stock,
    color: row.color,
    bg: row.background,
    tag: row.tag,
    imageUrl: row.image_url,
    active: Boolean(row.active),
    version: row.version,
  };
}
