const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const seedTemplates = require('./seed_templates');

function resolveSchemaPath() {
  const devPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(devPath)) return devPath;
  const packagedPath = path.join(process.resourcesPath || '', 'database', 'schema.sql');
  return packagedPath;
}

function initDatabase(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaSql = fs.readFileSync(resolveSchemaPath(), 'utf8');
  db.exec(schemaSql);

  const countYears = db.prepare('SELECT COUNT(*) AS total FROM annees_scolaires').get().total;
  if (countYears === 0) {
    const insertYear = db.prepare(
      'INSERT INTO annees_scolaires (libelle, est_active, est_archivee) VALUES (?, ?, ?)'
    );
    insertYear.run('2025/2026', 0, 1);
    insertYear.run('2026/2027', 1, 0);
  }

  seedTemplates(db);
  runMigrations(db);

  return db;
}

function runMigrations(db) {
  let currentVersion = db.pragma('user_version', { simple: true });
  if (currentVersion < 1) {
    const columns = db.prepare('PRAGMA table_info(modeles_rapports)').all();
    const hasDesc = columns.some((c) => c.name === 'description');
    if (!hasDesc) {
      db.exec("ALTER TABLE modeles_rapports ADD COLUMN description TEXT DEFAULT ''");
    }
    db.pragma('user_version = 1');
    currentVersion = 1;
  }
}

module.exports = { initDatabase };
