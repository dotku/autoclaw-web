import { NextRequest } from "next/server";
import { authenticateV1, apiSuccess, apiError } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/kb/documents/:id/chunks
 * List chunks for a document.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticateV1(req, "read");
  if ("status" in ctx) return ctx;

  const { id } = await params;
  const { sql, userId } = ctx;
  const docId = parseInt(id);
  if (isNaN(docId)) return apiError("Invalid document ID", 400);

  // Verify ownership
  const docs = await sql`SELECT id, user_id FROM kb_documents WHERE id = ${docId}`;
  if (docs.length === 0 || docs[0].user_id !== userId) return apiError("Document not found", 404);

  const chunks = await sql`
    SELECT chunk_index, content, token_count
    FROM kb_chunks WHERE document_id = ${docId}
    ORDER BY chunk_index ASC
  `;

  return apiSuccess({ chunks, total: chunks.length });
}
