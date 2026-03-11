import { NextRequest } from "next/server";
import { authenticateV1, apiSuccess, apiError } from "@/lib/api-v1";
import { extractUrl, chunkText, estimateTokens } from "@/lib/chunking";
import { generateEmbeddings, loadEmbeddingKeys, isOverBudget } from "@/lib/embeddings";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/kb/documents/:id
 * Get a single document with its chunks.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticateV1(req, "read");
  if ("status" in ctx) return ctx;

  const { id } = await params;
  const { sql, userId } = ctx;
  const docId = parseInt(id);
  if (isNaN(docId)) return apiError("Invalid document ID", 400);

  const docs = await sql`
    SELECT d.*, o.name as org_name FROM kb_documents d
    LEFT JOIN organizations o ON d.org_id = o.id
    WHERE d.id = ${docId} AND d.user_id = ${userId}
  `;
  if (docs.length === 0) return apiError("Document not found", 404);

  const chunks = await sql`
    SELECT chunk_index, content, token_count
    FROM kb_chunks WHERE document_id = ${docId}
    ORDER BY chunk_index ASC
  `;

  return apiSuccess({ document: docs[0], chunks });
}

/**
 * PATCH /api/v1/kb/documents/:id
 * Update a document (title, url for URL docs).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticateV1(req, "write");
  if ("status" in ctx) return ctx;

  const { id } = await params;
  const { sql, userId, plan } = ctx;
  const docId = parseInt(id);
  if (isNaN(docId)) return apiError("Invalid document ID", 400);

  const docs = await sql`SELECT id, user_id, doc_type, source_url FROM kb_documents WHERE id = ${docId}`;
  if (docs.length === 0 || docs[0].user_id !== userId) return apiError("Document not found", 404);

  const body = await req.json();
  const { title, url } = body;

  const isUrl = docs[0].doc_type === "url";
  const newUrl = isUrl ? url?.trim() || (docs[0].source_url as string) : undefined;
  const urlChanged = isUrl && newUrl && newUrl !== docs[0].source_url;

  // If URL changed, verify reachability
  if (urlChanged) {
    let reachable = false;
    try {
      const res = await fetch(newUrl, {
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AutoClaw/1.0)" },
        signal: AbortSignal.timeout(10000),
        redirect: "follow",
      });
      reachable = res.ok;
    } catch { /* try GET */ }
    if (!reachable) {
      try {
        const res = await fetch(newUrl, {
          method: "GET",
          headers: { "User-Agent": "Mozilla/5.0 (compatible; AutoClaw/1.0)" },
          signal: AbortSignal.timeout(10000),
          redirect: "follow",
        });
        reachable = res.ok;
      } catch { /* failed */ }
    }
    if (!reachable) return apiError("Could not reach new URL", 400);
  }

  // Update fields
  if (isUrl && newUrl) {
    await sql`
      UPDATE kb_documents SET
        title = ${title?.trim() || newUrl},
        source_url = ${newUrl},
        updated_at = NOW()
      WHERE id = ${docId}
    `;
  } else if (title?.trim()) {
    await sql`UPDATE kb_documents SET title = ${title.trim()}, updated_at = NOW() WHERE id = ${docId}`;
  }

  // Re-extract if URL changed
  if (urlChanged) {
    await sql`DELETE FROM kb_chunks WHERE document_id = ${docId}`;
    await sql`UPDATE kb_documents SET status = 'processing', chunk_count = 0, error_message = NULL WHERE id = ${docId}`;
    try {
      const text = await extractUrl(newUrl);
      const textSize = Buffer.byteLength(text, "utf-8");
      await sql`UPDATE kb_documents SET file_size = ${textSize} WHERE id = ${docId}`;

      const overBudget = await isOverBudget(sql);
      if (overBudget) {
        await sql`UPDATE kb_documents SET status = 'queued' WHERE id = ${docId}`;
      } else {
        const chunks = chunkText(text);
        if (chunks.length > 0) {
          await sql`UPDATE kb_documents SET chunk_count = ${chunks.length} WHERE id = ${docId}`;
          const byokKeys = await loadEmbeddingKeys(sql, userId);
          const BATCH_SIZE = 20;
          for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const embeddings = await generateEmbeddings(batch, byokKeys, sql, plan);
            for (let j = 0; j < batch.length; j++) {
              const embeddingStr = `[${embeddings[j].join(",")}]`;
              const tokenCount = estimateTokens(batch[j]);
              await sql`
                INSERT INTO kb_chunks (document_id, chunk_index, content, embedding, token_count)
                VALUES (${docId}, ${i + j}, ${batch[j]}, ${embeddingStr}::vector, ${tokenCount})
              `;
            }
          }
        }
        await sql`UPDATE kb_documents SET status = 'ready', updated_at = NOW() WHERE id = ${docId}`;
      }
    } catch {
      await sql`UPDATE kb_documents SET status = 'ready' WHERE id = ${docId}`;
    }
  }

  const updated = await sql`SELECT * FROM kb_documents WHERE id = ${docId}`;
  return apiSuccess({ document: updated[0] });
}

/**
 * DELETE /api/v1/kb/documents/:id
 * Delete a document and its chunks.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticateV1(req, "write");
  if ("status" in ctx) return ctx;

  const { id } = await params;
  const { sql, userId } = ctx;
  const docId = parseInt(id);
  if (isNaN(docId)) return apiError("Invalid document ID", 400);

  const docs = await sql`SELECT id, user_id FROM kb_documents WHERE id = ${docId}`;
  if (docs.length === 0 || docs[0].user_id !== userId) return apiError("Document not found", 404);

  await sql`DELETE FROM kb_documents WHERE id = ${docId}`;
  return apiSuccess({ deleted: true });
}
