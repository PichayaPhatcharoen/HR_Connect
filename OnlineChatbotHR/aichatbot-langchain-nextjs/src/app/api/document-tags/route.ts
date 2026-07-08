import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get("categoryId")
    const withCounts = searchParams.get("withCounts") === "true"

    const where = categoryId ? { CategoryId: categoryId } : {}

    const tags = await prisma.documentTag.findMany({
      where,
      orderBy: { DisplayOrder: "asc" },
      include: {
        Category: {
          select: {
            CategoryId: true,
            Name: true,
          },
        },
        _count: withCounts
          ? {
              select: {
                Documents: true,
              },
            }
          : false,
      },
    })

    // If withCounts requested, format the response
    if (withCounts) {
      const tagsWithCounts = tags.map((tag) => ({
        ...tag,
        documentCount: (tag as any)._count?.Documents || 0,
      }))
      return NextResponse.json(tagsWithCounts)
    }

    return NextResponse.json(tags)
  } catch (error) {
    console.error("Error fetching tags:", error)
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description, categoryId } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      )
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      )
    }

    const tag = await prisma.documentTag.create({
      data: {
        Name: name.trim(),
        Description: description?.trim() || null,
        CategoryId: categoryId,
      },
      include: {
        Category: {
          select: {
            CategoryId: true,
            Name: true,
          },
        },
      },
    })

    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    console.error("Error creating tag:", error)
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { tagId, name, description, displayOrder } = body

    if (!tagId) {
      return NextResponse.json(
        { error: "Tag ID is required" },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (name) updateData.Name = name
    if (description !== undefined) updateData.Description = description
    if (displayOrder !== undefined) updateData.DisplayOrder = displayOrder

    const tag = await prisma.documentTag.update({
      where: { TagId: tagId },
      data: updateData
    })

    return NextResponse.json(tag)
  } catch (error) {
    console.error("Error updating tag:", error)
    return NextResponse.json(
      { error: "Failed to update tag" },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tagId = searchParams.get("tagId")

    if (!tagId) {
      return NextResponse.json(
        { error: "Tag ID is required" },
        { status: 400 }
      )
    }

    const documentsUsingTag = await prisma.documentTagAssignment.count({
      where: { TagId: tagId },
    })

    if (documentsUsingTag > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete tag. ${documentsUsingTag} document(s) are using this tag.`,
        },
        { status: 409 }
      )
    }

    await prisma.documentTag.delete({
      where: { TagId: tagId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting tag:", error)
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    )
  }
}
