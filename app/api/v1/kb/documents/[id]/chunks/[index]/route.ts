import { NextRequest } from "next/server";
import { authenticateV1, apiSuccess, apiError } from "@/lib/api-v1";
import { generateEmbeddings, loadEmbeddingKeys } from "@/lib/embeddings";
import { estimateTokens } from "@/lib/chunking";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/v1/kb/documents/:id/chunks/:index
 * Update a chunk's content and re-generate its embedding.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const ctx = await authenticateV1(req, "write");
  if ("status" in ctx) return ctx;

  const { id, index } = await params;
  const { sql, userId, plan } = ctx;
  const docId = parseInt(id);
  const chunkIndex = parseInt(index);
  if (isNaN(docId) || isNaN(chunkIndex)) return apiError("Invalid ID or index", 400);

  // Verify ownership
  const docs = await sql`SELECT id, user_id FROM kb_documents WHERE id = ${docId}`;
  if (docs.length === 0 || docs[0].user_id !== userId) return apiError("Document not found", 404);

  const body = await req.json();
  const { content } = body;
  if (!content?.trim()) return apiError("content is required", 400);

  // Find chunk
  const chunks = await sql`
    SELECT id FROM kb_chunks WHERE document_id = ${docId} AND chunk_index = ${chunkIndex}
  `;
  if (chunks.length === 0) return apiError("Chunk not found", 404);
  const chunkId = chunks[0].id as number;

  const tokenCount = estimateTokens(content);
  const byokKeys = await loadEmbeddingKeys(sql, userId);

  try {
    const [embedding] = await generateEmbeddings([content], byokKeys, sql, plan);
    const embeddingStr = `[${embedding.join(",")}]`;
    await sql`
      UPDATE kb_chunks
      SET content = ${content}, embedding = ${embeddingStr}::vector, token_count = ${tokenCount}
      WHERE id = ${chunkId}
    `;
  } catch {
    await sql`
      UPDATE kb_chunks
      SET content = ${content}, embedding = NULL, token_count = ${tokenCount}
      WHERE id = ${chunkId}
    `;
  }

  return apiSuccess({ updated: true, chunk_index: chunkIndex, token_count: tokenCount });
}
