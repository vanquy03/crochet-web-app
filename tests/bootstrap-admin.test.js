import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.js';
import { bootstrapAdmin } from '../server/services/bootstrap-admin.js';
import { verifyPassword } from '../server/security.js';

test('temporary environment admin is optional, hashed and never overwrites an existing account', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  assert.equal(bootstrapAdmin(db, {}), false);
  assert.equal(db.prepare('SELECT count(*) AS n FROM admins').get().n, 0);
  assert.equal(
    bootstrapAdmin(db, { ADMIN_EMAIL: ' Owner@example.test ', ADMIN_PASSWORD: '1' }),
    true,
  );
  const original = db.prepare('SELECT * FROM admins').get();
  assert.equal(original.email, 'owner@example.test');
  assert.notEqual(original.password_hash, '1');
  assert.ok(verifyPassword('1', original.password_hash));
  assert.equal(
    bootstrapAdmin(db, { ADMIN_EMAIL: 'owner@example.test', ADMIN_PASSWORD: 'changed' }),
    false,
  );
  assert.equal(
    db.prepare('SELECT password_hash FROM admins').get().password_hash,
    original.password_hash,
  );
  assert.equal(db.prepare('SELECT count(*) AS n FROM admins').get().n, 1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM customers').get().n, 0);
});

test('incomplete environment bootstrap fails without creating accounts or exposing credentials', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  for (const env of [
    { ADMIN_EMAIL: 'owner@example.test' },
    { ADMIN_PASSWORD: 'private-password' },
    { ADMIN_EMAIL: 'invalid', ADMIN_PASSWORD: 'private-password' },
    { ADMIN_EMAIL: 'owner@example.test', ADMIN_PASSWORD: 'x'.repeat(201) },
  ]) {
    assert.throws(
      () => bootstrapAdmin(db, env),
      (error) => !error.message.includes('private-password'),
    );
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM admins').get().n, 0);
});
