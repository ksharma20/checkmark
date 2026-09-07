import { db } from '../index'

/**
 * A workspace's logo bytes.
 *
 * This file and `src/lib/storage.ts` are the only places outside
 * `db/queries/documents.ts` allowed to see base64 (invariant 23). Everything
 * above the storage seam hands over and receives `Buffer`.
 *
 * Unlike employee documents, the bytes and the metadata live in one row. There
 * is exactly one logo per workspace and nothing ever lists them, so the split
 * that keeps megabytes out of a folder view has nothing to buy here.
 */

export interface WorkspaceLogoRow {
  workspace_id: string
  mime_type: string
  size_bytes: number
  updated_at: string
}

/**
 * Write or replace the logo.
 *
 * `ON CONFLICT` on the primary key, so replacing is one statement. A
 * delete-then-insert would leave a window in which the workspace has no logo,
 * and a crash inside that window would leave it with none permanently.
 */
export async function upsertWorkspaceLogo(
  workspaceId: string,
  base64: string,
  mimeType: string,
  sizeBytes: number,
): Promise<void> {
  await db.execute(
    `INSERT INTO workspace_logos (workspace_id, mime_type, size_bytes, data_base64, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(workspace_id) DO UPDATE SET
       mime_type   = excluded.mime_type,
       size_bytes  = excluded.size_bytes,
       data_base64 = excluded.data_base64,
       updated_at  = datetime('now')`,
    [workspaceId, mimeType, sizeBytes, base64],
  )
}

/** The bytes, for the one route that serves them. */
export async function getWorkspaceLogoBlob(
  workspaceId: string,
): Promise<{ base64: string; mimeType: string; updatedAt: string } | null> {
  const row = await db.queryOne<{ data_base64: string; mime_type: string; updated_at: string }>(
    'SELECT data_base64, mime_type, updated_at FROM workspace_logos WHERE workspace_id = ?',
    [workspaceId],
  )
  return row ? { base64: row.data_base64, mimeType: row.mime_type, updatedAt: row.updated_at } : null
}

/**
 * Whether a logo exists, and when it changed - without reading the bytes.
 *
 * The shells need to know whether to render an `<img>` or fall back to the
 * generated swatch, and `updated_at` is what lets the image URL carry a
 * cache-busting parameter. Neither question should cost a base64 payload.
 */
export async function getWorkspaceLogoMeta(workspaceId: string): Promise<WorkspaceLogoRow | null> {
  return db.queryOne<WorkspaceLogoRow>(
    'SELECT workspace_id, mime_type, size_bytes, updated_at FROM workspace_logos WHERE workspace_id = ?',
    [workspaceId],
  )
}

export async function deleteWorkspaceLogo(workspaceId: string): Promise<void> {
  await db.execute('DELETE FROM workspace_logos WHERE workspace_id = ?', [workspaceId])
}
