import Database from 'better-sqlite3';
import type { Session, RoundResult, VerdictRow } from '../../shared/types';

export class SessionStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL,
        rounds_json TEXT NOT NULL,
        verdict_text TEXT,
        verdict_table_json TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL
      )
    `);
  }

  createSession(id: string, prompt: string): void {
    this.db
      .prepare(
        `INSERT INTO sessions (id, prompt, status, rounds_json, verdict_text, verdict_table_json, error_message, created_at)
         VALUES (?, ?, 'running', '[]', NULL, NULL, NULL, ?)`,
      )
      .run(id, prompt, new Date().toISOString());
  }

  appendRound(id: string, result: RoundResult): void {
    const session = this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    const rounds = [...session.rounds, result];
    this.db.prepare(`UPDATE sessions SET rounds_json = ? WHERE id = ?`).run(JSON.stringify(rounds), id);
  }

  setVerdict(id: string, verdictText: string, verdictTable: VerdictRow[]): void {
    const session = this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    this.db
      .prepare(`UPDATE sessions SET status = 'complete', verdict_text = ?, verdict_table_json = ? WHERE id = ?`)
      .run(verdictText, JSON.stringify(verdictTable), id);
  }

  setError(id: string, message: string): void {
    const session = this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    this.db.prepare(`UPDATE sessions SET status = 'error', error_message = ? WHERE id = ?`).run(message, id);
  }

  getSession(id: string): Session | null {
    const row = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return rowToSession(row);
  }

  listSessions(): Session[] {
    const rows = this.db.prepare(`SELECT * FROM sessions ORDER BY created_at DESC, rowid DESC`).all() as any[];
    return rows.map(rowToSession);
  }
}

function rowToSession(row: any): Session {
  return {
    id: row.id,
    prompt: row.prompt,
    status: row.status,
    rounds: JSON.parse(row.rounds_json),
    verdictText: row.verdict_text,
    verdictTable: row.verdict_table_json ? JSON.parse(row.verdict_table_json) : null,
    createdAt: row.created_at,
    errorMessage: row.error_message,
  };
}
