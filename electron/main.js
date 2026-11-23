const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { autoUpdater } = require('electron-updater');
const { initDatabase } = require('./database/db');

const userDataPath = app.getPath('userData');
const assetsDir = path.join(userDataPath, 'assets');
const dbPath = path.join(userDataPath, 'edumanager.db');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

let db;
let mainWindow;

function setupAutoUpdater(win) {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    win?.webContents.send('updater:status', { status: 'available', version: info.version });
  });
  autoUpdater.on('update-downloaded', (info) => {
    win?.webContents.send('updater:status', { status: 'downloaded', version: info.version });
  });
  autoUpdater.on('error', (err) => {
    win?.webContents.send('updater:status', {
      status: 'error',
      message: err?.message || 'Erreur de mise à jour'
    });
  });
  autoUpdater.checkForUpdatesAndNotify();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    setupAutoUpdater(mainWindow);
  }
}

app.whenReady().then(() => {
  db = initDatabase(dbPath);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('updater:check', async () => {
  if (!app.isPackaged) return { devMode: true };
  return await autoUpdater.checkForUpdates();
});

ipcMain.handle('updater:install-now', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('upload-logo', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const sourcePath = result.filePaths[0];
  const ext = path.extname(sourcePath);
  const destPath = path.join(assetsDir, `logo${ext}`);
  fs.copyFileSync(sourcePath, destPath);

  db.prepare('UPDATE parametres_etablissement SET logo_path = ? WHERE id = 1').run(destPath);
  return destPath;
});

ipcMain.handle('create-backup', async () => {
  const dateStr = new Date().toISOString().slice(0, 10);
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: `Backup_EduManager_${dateStr}.zip`,
    filters: [{ name: 'Archive Backup', extensions: ['zip'] }]
  });
  if (!filePath) return { canceled: true };

  db.pragma('wal_checkpoint(FULL)');
  const zip = new AdmZip();
  zip.addLocalFile(dbPath);
  if (fs.existsSync(assetsDir)) {
    zip.addLocalFolder(assetsDir, 'assets');
  }
  zip.writeZip(filePath);
  return { success: true, path: filePath };
});

ipcMain.handle('restore-backup', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Archive Backup', extensions: ['zip'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };

  fs.copyFileSync(dbPath, `${dbPath}.bak`);
  db.close();

  const zip = new AdmZip(result.filePaths[0]);
  zip.extractAllTo(userDataPath, true);

  app.relaunch();
  app.exit(0);
});

ipcMain.handle('db:get-school-years', () => {
  return db.prepare('SELECT * FROM annees_scolaires ORDER BY id ASC').all();
});

ipcMain.handle('db:set-active-school-year', (_, yearId) => {
  const tx = db.transaction((id) => {
    db.prepare('UPDATE annees_scolaires SET est_active = 0').run();
    db.prepare('UPDATE annees_scolaires SET est_active = 1, est_archivee = 0 WHERE id = ?').run(id);
  });
  tx(yearId);
  return { success: true };
});

ipcMain.handle('db:create-school-year', (_, { libelle, makeActive = false }) => {
  const cleanLabel = String(libelle || '').trim();
  if (!cleanLabel) return { success: false, error: 'Libellé manquant' };
  const tx = db.transaction((label, activeFlag) => {
    if (activeFlag) db.prepare('UPDATE annees_scolaires SET est_active = 0').run();
    const info = db
      .prepare('INSERT INTO annees_scolaires (libelle, est_active, est_archivee) VALUES (?, ?, 0)')
      .run(label, activeFlag ? 1 : 0);
    return info.lastInsertRowid;
  });
  return { success: true, id: tx(cleanLabel, makeActive) };
});

ipcMain.handle('db:get-settings', () => {
  return db.prepare('SELECT * FROM parametres_etablissement WHERE id = 1').get() || {};
});

ipcMain.handle('db:update-settings', (_, data) => {
  db.prepare(`
    UPDATE parametres_etablissement
    SET
      ministere = COALESCE(?, ministere),
      academie = COALESCE(?, academie),
      direction_provinciale = COALESCE(?, direction_provinciale),
      nom_etablissement = COALESCE(?, nom_etablissement),
      code_gresa = COALESCE(?, code_gresa),
      adresse = COALESCE(?, adresse),
      telephone = COALESCE(?, telephone)
    WHERE id = 1
  `).run(
    data.ministere ?? null,
    data.academie ?? null,
    data.direction_provinciale ?? null,
    data.nom_etablissement ?? null,
    data.code_gresa ?? null,
    data.adresse ?? null,
    data.telephone ?? null
  );
  return { success: true };
});

ipcMain.handle('db:get-year-data', (_, yearId) => {
  const yId = Number(yearId);
  if (!yId) {
    return { classes: [], students: [], teachers: [], schedules: [], movements: [], templates: [] };
  }
  const classes = db.prepare('SELECT * FROM classes WHERE annee_scolaire_id = ? ORDER BY nom ASC').all(yId);
  const students = db
    .prepare(`
      SELECT e.*, c.nom AS classe_nom, c.niveau AS niveau
      FROM eleves e
      LEFT JOIN classes c ON e.classe_id = c.id
      WHERE e.annee_scolaire_id = ?
      ORDER BY c.nom ASC, e.nom ASC, e.prenom ASC
    `)
    .all(yId);
  const teachers = db
    .prepare('SELECT * FROM professeurs WHERE annee_scolaire_id = ? ORDER BY nom ASC, prenom ASC')
    .all(yId);
  const schedules = db
    .prepare(`
      SELECT edt.*, c.nom AS classe_nom, p.matricule AS prof_matricule,
             TRIM(COALESCE(p.nom, '') || ' ' || COALESCE(p.prenom, '')) AS prof_nom
      FROM emplois_du_temps edt
      INNER JOIN classes c ON edt.classe_id = c.id
      LEFT JOIN professeurs p ON edt.prof_id = p.id
      WHERE edt.annee_scolaire_id = ?
      ORDER BY edt.jour ASC, edt.seance ASC
    `)
    .all(yId);
  const movements = db
    .prepare('SELECT * FROM mouvements_eleves WHERE annee_scolaire_id = ? ORDER BY id DESC')
    .all(yId);
  const templates = db.prepare('SELECT * FROM modeles_rapports ORDER BY id ASC').all();

  return { classes, students, teachers, schedules, movements, templates };
});

ipcMain.handle('import:students', (_, { yearId, rows = [] }) => {
  const yId = Number(yearId);
  const getOrCreateClassId = (className) => {
    const cleanName = String(className || '').trim();
    if (!cleanName) return null;
    const existing = db
      .prepare('SELECT id FROM classes WHERE annee_scolaire_id = ? AND nom = ?')
      .get(yId, cleanName);
    if (existing) return existing.id;
    const inferredLevel = cleanName.split('-')[0].trim();
    const info = db
      .prepare('INSERT INTO classes (annee_scolaire_id, nom, niveau) VALUES (?, ?, ?)')
      .run(yId, cleanName, inferredLevel);
    return info.lastInsertRowid;
  };

  const upsertStmt = db.prepare(`
    INSERT INTO eleves (
      annee_scolaire_id, code_eleve, nom, prenom, genre, date_naissance, classe_id, statut
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'actif')
    ON CONFLICT(annee_scolaire_id, code_eleve) DO UPDATE SET
      nom = COALESCE(NULLIF(excluded.nom, ''), eleves.nom),
      prenom = COALESCE(NULLIF(excluded.prenom, ''), eleves.prenom),
      genre = COALESCE(NULLIF(excluded.genre, ''), eleves.genre),
      date_naissance = COALESCE(NULLIF(excluded.date_naissance, ''), eleves.date_naissance),
      classe_id = COALESCE(excluded.classe_id, eleves.classe_id)
  `);

  const tx = db.transaction((list) => {
    let count = 0;
    for (const r of list) {
      const classeId = getOrCreateClassId(r.classe_nom);
      upsertStmt.run(
        yId,
        String(r.code_eleve).trim(),
        r.nom || '',
        r.prenom || '',
        r.genre || '',
        r.date_naissance || '',
        classeId
      );
      count++;
    }
    return count;
  });

  return { success: true, count: tx(rows) };
});

ipcMain.handle('import:guardians', (_, { yearId, rows = [] }) => {
  const yId = Number(yearId);
  const mergeStmt = db.prepare(`
    UPDATE eleves
    SET
      tuteur_nom = COALESCE(NULLIF(?, ''), tuteur_nom),
      tuteur_lien = COALESCE(NULLIF(?, ''), tuteur_lien),
      tuteur_telephone = COALESCE(NULLIF(?, ''), tuteur_telephone),
      tuteur_cin = COALESCE(NULLIF(?, ''), tuteur_cin)
    WHERE annee_scolaire_id = ? AND code_eleve = ?
  `);

  const tx = db.transaction((list) => {
    let updated = 0;
    for (const r of list) {
      const info = mergeStmt.run(
        r.tuteur_nom || '',
        r.tuteur_lien || '',
        r.tuteur_telephone || '',
        r.tuteur_cin || '',
        yId,
        String(r.code_eleve).trim()
      );
      updated += info.changes;
    }
    return updated;
  });

  return { success: true, count: tx(rows) };
});

ipcMain.handle('import:teachers', (_, { yearId, rows = [] }) => {
  const yId = Number(yearId);
  const upsertStmt = db.prepare(`
    INSERT INTO professeurs (annee_scolaire_id, matricule, nom, prenom, matiere, telephone)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(annee_scolaire_id, matricule) DO UPDATE SET
      nom = COALESCE(NULLIF(excluded.nom, ''), professeurs.nom),
      prenom = COALESCE(NULLIF(excluded.prenom, ''), professeurs.prenom),
      matiere = COALESCE(NULLIF(excluded.matiere, ''), professeurs.matiere),
      telephone = COALESCE(NULLIF(excluded.telephone, ''), professeurs.telephone)
  `);

  const tx = db.transaction((list) => {
    let count = 0;
    for (const r of list) {
      upsertStmt.run(
        yId,
        String(r.matricule).trim(),
        r.nom || '',
        r.prenom || '',
        r.matiere || '',
        r.telephone || ''
      );
      count++;
    }
    return count;
  });

  return { success: true, count: tx(rows) };
});

ipcMain.handle('import:schedule', (_, { yearId, rows = [] }) => {
  const yId = Number(yearId);
  const findClassStmt = db.prepare('SELECT id FROM classes WHERE annee_scolaire_id = ? AND nom = ?');
  const insertClassStmt = db.prepare('INSERT INTO classes (annee_scolaire_id, nom, niveau) VALUES (?, ?, ?)');
  const findProfByMatStmt = db.prepare('SELECT id FROM professeurs WHERE annee_scolaire_id = ? AND matricule = ?');
  const findProfByFullNameStmt = db.prepare(
    `SELECT id FROM professeurs
     WHERE annee_scolaire_id = ?
     AND LOWER(TRIM(nom || ' ' || prenom)) = LOWER(TRIM(?))`
  );
  const upsertScheduleStmt = db.prepare(`
    INSERT INTO emplois_du_temps (
      annee_scolaire_id, classe_id, prof_id, jour, seance, matiere, salle
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(annee_scolaire_id, classe_id, jour, seance) DO UPDATE SET
      prof_id = COALESCE(excluded.prof_id, emplois_du_temps.prof_id),
      matiere = COALESCE(NULLIF(excluded.matiere, ''), emplois_du_temps.matiere),
      salle = COALESCE(NULLIF(excluded.salle, ''), emplois_du_temps.salle)
  `);

  const tx = db.transaction((list) => {
    let count = 0;
    for (const r of list) {
      const className = String(r.classe_nom || '').trim();
      if (!className) continue;
      let cls = findClassStmt.get(yId, className);
      if (!cls) {
        const level = className.split('-')[0].trim();
        const info = insertClassStmt.run(yId, className, level);
        cls = { id: info.lastInsertRowid };
      }
      let profId = null;
      if (r.prof_matricule) {
        const p = findProfByMatStmt.get(yId, String(r.prof_matricule).trim());
        if (p) profId = p.id;
      }
      if (!profId && r.prof_nom) {
        const p = findProfByFullNameStmt.get(yId, String(r.prof_nom).trim());
        if (p) profId = p.id;
      }
      upsertScheduleStmt.run(
        yId,
        cls.id,
        profId,
        Number(r.jour),
        Number(r.seance),
        r.matiere || '',
        r.salle || ''
      );
      count++;
    }
    return count;
  });

  return { success: true, count: tx(rows) };
});

ipcMain.handle('import:movements', (_, { yearId, categoryKey, rows = [] }) => {
  const yId = Number(yearId);
  const validCategories = ['arrive', 'parti', 'abandon', 'non_rejoint'];
  const cat = validCategories.includes(categoryKey) ? categoryKey : 'arrive';

  const insertMovementStmt = db.prepare(`
    INSERT INTO mouvements_eleves (
      annee_scolaire_id, code_eleve, nom_complet, classe_nom, type_mouvement,
      date_mouvement, etablissement_origine_dest, motif, tuteur_nom, tuteur_telephone
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const syncStudentStatusStmt = db.prepare(
    'UPDATE eleves SET statut = ? WHERE annee_scolaire_id = ? AND code_eleve = ?'
  );

  const tx = db.transaction((list) => {
    let count = 0;
    for (const r of list) {
      const code = String(r.code_eleve).trim();
      insertMovementStmt.run(
        yId,
        code,
        r.nom_complet || '',
        r.classe_nom || '',
        cat,
        r.date_mouvement || '',
        r.etablissement_origine_dest || '',
        r.motif || '',
        r.tuteur_nom || '',
        r.tuteur_telephone || ''
      );
      syncStudentStatusStmt.run(cat, yId, code);
      count++;
    }
    return count;
  });

  return { success: true, count: tx(rows) };
});
