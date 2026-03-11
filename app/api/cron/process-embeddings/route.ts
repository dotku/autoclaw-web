import { NextRequest, NextResponse } from "next/server";
import { getDb, resolveUserPlan } from "@/lib/db";
import { generateEmbeddings, loadEmbeddingKeys, isOverBudget } from "@/lib/embeddings";
import { chunkText, estimateTokens, extractUrl } from "@/lib/chunking";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Vercel Cron endpoint — processes queued KB documents that were deferred
 * due to embedding budget limits. Runs daily via vercel.json.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();

  // Check if we're still over budget
  const overBudget = await isOverBudget(sql);
  if (overBudget) {
    return NextResponse.json({ message: "Still over budget, skipping", processed: 0 });
  }

  // Get queued documents (limit to 10 per run to stay within function timeout)
  const queued = await sql`
    SELECT id, user_id, doc_type, source_url FROM kb_documents
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 10
  `;

  if (queued.length === 0) {
    return NextResponse.json({ message: "No queued documents", processed: 0 });
  }

  let processed = 0;
  let errors = 0;

  for (const doc of queued) {
    // Re-check budget before each document
    if (await isOverBudget(sql)) {
      break;
    }

    const docId = doc.id as number;
    const userId = doc.user_id as number;

    // Resolve user plan to determine system key eligibility
    const userRow = await sql`SELECT plan FROM users WHERE id = ${userId}`;
    const plan = userRow.length > 0 ? await resolveUserPlan(sql, userId, (userRow[0].plan as string) || "starter") : "starter";

    try {
      // Get or extract text content
      let text: string | null = null;

      if (doc.doc_type === "url" && doc.source_url) {
        try {
          text = await extractUrl(doc.source_url as string);
        } catch {
          // URL extraction failed — mark ready without embeddings
          await sql`UPDATE kb_documents SET status = 'ready' WHERE id = ${docId}`;
          processed++;
          continue;
        }
      } else {
        // For non-URL docs, check if chunks already exist without embeddings
        const existingChunks = await sql`
          SELECT id, content FROM kb_chunks
          WHERE document_id = ${docId} AND embedding IS NULL
          LIMIT 1
        `;
        if (existingChunks.length > 0) {
          // Re-embed existing chunks
          const allChunks = await sql`
            SELECT id, content FROM kb_chunks
            WHERE document_id = ${docId}
            ORDER BY chunk_index ASC
          `;
          const byokKeys = await loadEmbeddingKeys(sql, userId);
          const BATCH_SIZE = 20;
          for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
            const batch = allChunks.slice(i, i + BATCH_SIZE);
            const texts = batch.map((c) => c.content as string);
            const embeddings = await generateEmbeddings(texts, byokKeys, sql, plan);
            for (let j = 0; j < batch.length; j++) {
              const embeddingStr = `[${embeddings[j].join(",")}]`;
              await sql`UPDATE kb_chunks SET embedding = ${embeddingStr}::vector WHERE id = ${batch[j].id}`;
            }
          }
          await sql`UPDATE kb_documents SET status = 'ready', updated_at = NOW() WHERE id = ${docId}`;
          processed++;
          continue;
        }
      }

      if (text) {
        const chunks = chunkText(text);
        if (chunks.length === 0) {
          await sql`UPDATE kb_documents SET status = 'ready' WHERE id = ${docId}`;
          processed++;
          continue;
        }

        await sql`UPDATE kb_documents SET status = 'processing', chunk_count = ${chunks.length} WHERE id = ${docId}`;
        const byokKeys = await loadEmbeddingKeys(sql, userId);

        const BATCH_SIZE = 20;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const batch = chunks.slice(i, i + BATCH_SIZE);
          const embeddings = await generateEmbeddings(batch, byokKeys, sql, plan);
          for (let j = 0; j < batch.length; j++) {
            const chunkIndex = i + j;
            const embeddingStr = `[${embeddings[j].join(",")}]`;
            const tokenCount = estimateTokens(batch[j]);
            await sql`
              INSERT INTO kb_chunks (document_id, chunk_index, content, embedding, token_count)
              VALUES (${docId}, ${chunkIndex}, ${batch[j]}, ${embeddingStr}::vector, ${tokenCount})
            `;
          }
        }

        const textSize = Buffer.byteLength(text, "utf-8");
        await sql`UPDATE kb_documents SET status = 'ready', file_size = ${textSize}, updated_at = NOW() WHERE id = ${docId}`;
      } else {
        // No text to process, just mark ready
        await sql`UPDATE kb_documents SET status = 'ready' WHERE id = ${docId}`;
      }

      processed++;
    } catch (e) {
      errors++;
      const errMsg = e instanceof Error ? e.message : "Processing failed";
      await sql`UPDATE kb_documents SET status = 'error', error_message = ${errMsg} WHERE id = ${docId}`;
    }
  }

  return NextResponse.json({
    message: `Processed ${processed} documents, ${errors} errors`,
    processed,
    errors,
    remaining: queued.length - processed - errors,
  });
}
