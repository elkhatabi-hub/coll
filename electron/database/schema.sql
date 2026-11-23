PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS parametres_etablissement (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ministere TEXT DEFAULT 'المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي والرياضة',
  academie TEXT DEFAULT '',
  direction_provinciale TEXT DEFAULT '',
  nom_etablissement TEXT DEFAULT '',
  code_gresa TEXT DEFAULT '',
  adresse TEXT DEFAULT '',
  telephone TEXT DEFAULT '',
  logo_path TEXT DEFAULT ''
);

INSERT OR IGNORE INTO parametres_etablissement (id) VALUES (1);

CREATE TABLE IF NOT EXISTS annees_scolaires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  libelle TEXT NOT NULL UNIQUE,
  est_active INTEGER DEFAULT 0,
  est_archivee INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annee_scolaire_id INTEGER NOT NULL,
  nom TEXT NOT NULL,
  niveau TEXT,
  filiere TEXT,
  UNIQUE(annee_scolaire_id, nom),
  FOREIGN KEY (annee_scolaire_id) REFERENCES annees_scolaires(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eleves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annee_scolaire_id INTEGER NOT NULL,
  code_eleve TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  genre TEXT,
  date_naissance TEXT,
  classe_id INTEGER,
  statut TEXT DEFAULT 'actif',
  tuteur_nom TEXT,
  tuteur_lien TEXT,
  tuteur_telephone TEXT,
  tuteur_cin TEXT,
  UNIQUE(annee_scolaire_id, code_eleve),
  FOREIGN KEY (annee_scolaire_id) REFERENCES annees_scolaires(id) ON DELETE CASCADE,
  FOREIGN KEY (classe_id) REFERENCES classes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS professeurs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annee_scolaire_id INTEGER NOT NULL,
  matricule TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  matiere TEXT,
  telephone TEXT,
  UNIQUE(annee_scolaire_id, matricule),
  FOREIGN KEY (annee_scolaire_id) REFERENCES annees_scolaires(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS emplois_du_temps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annee_scolaire_id INTEGER NOT NULL,
  classe_id INTEGER NOT NULL,
  prof_id INTEGER,
  jour INTEGER NOT NULL CHECK (jour BETWEEN 1 AND 6),
  seance INTEGER NOT NULL CHECK (seance BETWEEN 1 AND 8),
  matiere TEXT,
  salle TEXT,
  UNIQUE(annee_scolaire_id, classe_id, jour, seance),
  FOREIGN KEY (annee_scolaire_id) REFERENCES annees_scolaires(id) ON DELETE CASCADE,
  FOREIGN KEY (classe_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (prof_id) REFERENCES professeurs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS mouvements_eleves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annee_scolaire_id INTEGER NOT NULL,
  code_eleve TEXT NOT NULL,
  nom_complet TEXT NOT NULL,
  classe_nom TEXT,
  type_mouvement TEXT NOT NULL CHECK (type_mouvement IN ('arrive', 'parti', 'abandon', 'non_rejoint')),
  date_mouvement TEXT,
  etablissement_origine_dest TEXT,
  motif TEXT,
  tuteur_nom TEXT,
  tuteur_telephone TEXT,
  FOREIGN KEY (annee_scolaire_id) REFERENCES annees_scolaires(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS modeles_rapports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_modele TEXT NOT NULL UNIQUE,
  categorie TEXT NOT NULL,
  titre TEXT NOT NULL,
  cible TEXT NOT NULL,
  langue TEXT DEFAULT 'ar',
  corps_modele TEXT NOT NULL,
  signataire_defaut TEXT DEFAULT 'surveillant_general'
);
