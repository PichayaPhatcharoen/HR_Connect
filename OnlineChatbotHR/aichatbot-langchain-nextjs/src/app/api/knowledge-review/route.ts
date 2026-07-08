import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// GET /api/knowledge-review?type=drafts|published|stats
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") || "drafts"

  try {
    if (type === "drafts") {
      const drafts = await (prisma as any).knowledgeDraft.findMany({
        where: { Status: { in: ["DRAFT", "PUBLISHED"] } },
        orderBy: { CreatedAt: "desc" },
        select: {
          KnowledgeDraftId: true,
          Title: true,
          Body: true,
          Domain: true,
          Intent: true,
          Keywords: true,
          SourceRef: true,
          Status: true,
          PublishedAt: true,
          CreatedAt: true,
        },
      })
      return NextResponse.json(drafts)
    }

    if (type === "published") {
      const published = await (prisma as any).knowledgeDraft.findMany({
        where: { Status: "PUBLISHED" },
        orderBy: { PublishedAt: "desc" },
        select: {
          KnowledgeDraftId: true,
          Title: true,
          Body: true,
          Domain: true,
          Intent: true,
          Keywords: true,
          SourceRef: true,
          Status: true,
          PublishedAt: true,
          CreatedAt: true,
        },
      })
      return NextResponse.json(published)
    }

    if (type === "stats") {
      const [draftCount, publishedCount, totalCount] = await Promise.all([
        (prisma as any).knowledgeDraft.count({ where: { Status: "DRAFT" } }),
        (prisma as any).knowledgeDraft.count({ where: { Status: "PUBLISHED" } }),
        (prisma as any).knowledgeDraft.count(),
      ])
      return NextResponse.json({ draftCount, publishedCount, totalCount })
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 })
  } catch (err: any) {
    console.error("[knowledge-review GET error]:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch knowledge drafts" }, { status: 500 })
  }
}

// POST /api/knowledge-review
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type } = body

    // Create new draft
    if (type === "create-draft") {
      const { title, body: content, domain, intent, keywords, sourceRef } = body
      
      if (!title?.trim() || !content?.trim()) {
        return NextResponse.json({ error: "Title and body are required" }, { status: 400 })
      }

      const draft = await (prisma as any).knowledgeDraft.create({
        data: {
          Title: title.trim(),
          Body: content.trim(),
          Domain: domain || "general",
          Intent: intent || "general_knowledge",
          Keywords: keywords || [],
          SourceRef: sourceRef || null,
          Status: "DRAFT",
        },
      })

      return NextResponse.json({ ok: true, draft })
    }

    // Update existing draft
    if (type === "update-draft") {
      const { draftId, title, body: content, domain, intent, keywords, sourceRef } = body
      
      if (!draftId) {
        return NextResponse.json({ error: "Draft ID is required" }, { status: 400 })
      }

      // Check if draft is published (for re-ingest)
      const existingDraft = await (prisma as any).knowledgeDraft.findUnique({
        where: { KnowledgeDraftId: draftId },
        select: { Status: true },
      })

      const wasPublished = existingDraft?.Status === "PUBLISHED"

      const draft = await (prisma as any).knowledgeDraft.update({
        where: { KnowledgeDraftId: draftId },
        data: {
          Title: title?.trim(),
          Body: content?.trim(),
          Domain: domain,
          Intent: intent,
          Keywords: keywords || [],
          SourceRef: sourceRef || null,
          UpdatedAt: new Date(),
        },
      })

      // If draft was published, re-ingest to update chunks
      if (wasPublished) {
        try {
          const ingestRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/knowledge-ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ draftId }),
          })
          
          if (!ingestRes.ok) {
            console.warn("[knowledge-review] Re-ingest warning:", await ingestRes.text())
          }
        } catch (ingestErr) {
          console.error("[knowledge-review] Re-ingest error:", ingestErr)
          // Don't fail the update if re-ingest fails
        }
      }

      return NextResponse.json({ ok: true, draft, reIngested: wasPublished })
    }

    // Approve draft (publish)
    if (type === "approve") {
      const { draftId } = body
      
      if (!draftId) {
        return NextResponse.json({ error: "Draft ID is required" }, { status: 400 })
      }

      // Update draft status to published
      const draft = await (prisma as any).knowledgeDraft.update({
        where: { KnowledgeDraftId: draftId },
        data: {
          Status: "PUBLISHED",
          PublishedAt: new Date(),
        },
      })

      // Call knowledge-ingest to embed the draft
      try {
        const ingestRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/knowledge-ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId }),
        })
        
        if (!ingestRes.ok) {
          console.warn("[knowledge-review] Ingest warning:", await ingestRes.text())
        }
      } catch (ingestErr) {
        console.error("[knowledge-review] Ingest error:", ingestErr)
        // Don't fail the approve if ingest fails - draft is still marked as published
      }

      return NextResponse.json({ ok: true, draft })
    }

    // Archive draft (soft delete)
    if (type === "archive") {
      const { draftId } = body
      
      if (!draftId) {
        return NextResponse.json({ error: "Draft ID is required" }, { status: 400 })
      }

      const draft = await (prisma as any).knowledgeDraft.update({
        where: { KnowledgeDraftId: draftId },
        data: {
          Status: "ARCHIVED",
          UpdatedAt: new Date(),
        },
      })

      return NextResponse.json({ ok: true, draft })
    }

    // Hard delete draft and related chunks
    if (type === "hard-delete") {
      const { draftId } = body
      
      if (!draftId) {
        return NextResponse.json({ error: "Draft ID is required" }, { status: 400 })
      }

      // Find the SourceDocument associated with this draft (if published)
      const sourceDoc = await (prisma as any).sourceDocuments.findFirst({
        where: { SourceDocumentId: draftId },
      })

      if (sourceDoc) {
        // Delete all chunks related to this source document
        await (prisma as any).documentChunks.deleteMany({
          where: { SourceDocumentId: sourceDoc.SourceDocumentId },
        })

        // Delete the source document
        await (prisma as any).sourceDocuments.delete({
          where: { SourceDocumentId: sourceDoc.SourceDocumentId },
        })
      }

      // Finally, delete the draft itself
      await (prisma as any).knowledgeDraft.delete({
        where: { KnowledgeDraftId: draftId },
      })

      return NextResponse.json({ ok: true, deleted: true, deletedChunks: !!sourceDoc })
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 })
  } catch (err: any) {
    console.error("[knowledge-review POST error]:", err)
    return NextResponse.json({ error: err.message || "Operation failed" }, { status: 500 })
  }
}
