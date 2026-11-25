import { neon } from "@neondatabase/serverless";

export type Actor = "agent" | "person";
export type Hold = { bookId: string; placedBy: Actor; at: string };
export type Activity = { action: "placed_hold" | "viewed_holds"; actor: Actor; bookId: string | null; at: string };
export type LibraryStore = {
  place(account: string, bookId: string, actor: Actor): Promise<Hold>;
  holds(account: string, actor: Actor): Promise<Hold[]>;
  activity(account: string): Promise<Activity[]>;
};

export function memoryStore(): LibraryStore {
  const holds = new Map<string, Hold[]>();
  const activity = new Map<string, Activity[]>();
  function record(account: string, entry: Activity) {
    activity.set(account, [entry, ...(activity.get(account) ?? [])].slice(0, 50));
  }
  return {
    async place(account, bookId, actor) {
      const current = holds.get(account) ?? [];
      const existing = current.find((hold) => hold.bookId === bookId);
      if (existing) return existing;
      const at = new Date().toISOString();
      const hold = { bookId, placedBy: actor, at };
      holds.set(account, [hold, ...current]);
      record(account, { action: "placed_hold", actor, bookId, at });
      return hold;
    },
    async holds(account, actor) {
      record(account, { action: "viewed_holds", actor, bookId: null, at: new Date().toISOString() });
      return holds.get(account) ?? [];
    },
    async activity(account) {
      return activity.get(account) ?? [];
    },
  };
}

function neonStore(url: string): LibraryStore {
  const sql = neon(url);
  return {
    async place(account, bookId, actor) {
      const [created] = await sql`
        WITH placed AS (
          INSERT INTO library_holds (account, book_id, placed_by)
          VALUES (${account}, ${bookId}, ${actor})
          ON CONFLICT (account, book_id) DO NOTHING
          RETURNING account, book_id, placed_by
        )
        INSERT INTO library_activity (account, action, actor, book_id)
        SELECT account, 'placed_hold', placed_by, book_id FROM placed
        RETURNING book_id AS "bookId", actor AS "placedBy", at
      `;
      if (created) return created as Hold;
      const [existing] = await sql`
        SELECT book_id AS "bookId", placed_by AS "placedBy", at FROM library_holds
        WHERE account = ${account} AND book_id = ${bookId}
      `;
      return existing as Hold;
    },
    async holds(account, actor) {
      const [rows] = await sql.transaction([
        sql`SELECT book_id AS "bookId", placed_by AS "placedBy", at FROM library_holds WHERE account = ${account} ORDER BY at DESC`,
        sql`INSERT INTO library_activity (account, action, actor) VALUES (${account}, 'viewed_holds', ${actor})`,
      ]);
      return rows as Hold[];
    },
    async activity(account) {
      return await sql`
        SELECT action, actor, book_id AS "bookId", at FROM library_activity
        WHERE account = ${account} ORDER BY id DESC LIMIT 50
      ` as Activity[];
    },
  };
}

let currentStore: LibraryStore | undefined;
export function libraryStore() {
  const url = process.env.DATABASE_URL;
  if (process.env.VERCEL && !url) throw Error("DATABASE_URL is required on Vercel.");
  return currentStore ??= url ? neonStore(url) : memoryStore();
}
