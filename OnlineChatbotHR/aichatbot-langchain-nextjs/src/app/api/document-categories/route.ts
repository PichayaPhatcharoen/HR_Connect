import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET categories ที่มี document counts
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const includeTags = searchParams.get("includeTags") === "true"
    const withCounts = searchParams.get("withCounts") === "true"

    const categories = await prisma.documentCategory.findMany({
      orderBy: { DisplayOrder: "asc" },
      include: {
        Tags: includeTags
          ? {
            orderBy: { DisplayOrder: "asc" },
          }
          : false,
        _count: withCounts
          ? {
            select: {
              Tags: true,
            },
          }
          : false,
      },
    })

    // ถ้ามีการขอจำนวนเอกสาร ให้ format response
    if (withCounts) {
      const docCounts = await prisma.sourceDocuments.groupBy({
        by: ["CategoryId"],
        where: {
          CategoryId: { not: null },
        },
        _count: {
          SourceDocumentId: true,
        },
      })

      const countMap = new Map(
        docCounts.map((c) => [c.CategoryId, c._count.SourceDocumentId])
      )

      const categoriesWithCounts = categories.map((cat) => ({
        ...cat,
        documentCount: countMap.get(cat.CategoryId) || 0,
      }))

      return NextResponse.json(categoriesWithCounts)
    }

    return NextResponse.json(categories)
  } catch (error) {
    console.error("Error fetching categories:", error)
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      )
    }

    const category = await prisma.documentCategory.create({
      data: {
        Name: name.trim(),
        Description: description?.trim() || null,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error: any) {
    console.error("Error creating category:", error)
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Category name already exists" },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    )
  }
}

// DELETE category
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get("categoryId")

    if (!categoryId) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      )
    }

    // เช็คว่ามีเอกสารใช้ category นี้ไหม
    const documentsUsingCategory = await prisma.sourceDocuments.count({
      where: { CategoryId: categoryId },
    })

    if (documentsUsingCategory > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category. ${documentsUsingCategory} document(s) are using this category.`,
        },
        { status: 409 }
      )
    }

    // เช็คว่ามี tag ใช้ category นี้ไหม
    const tagsInCategory = await prisma.documentTag.count({
      where: { CategoryId: categoryId },
    })

    if (tagsInCategory > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category. ${tagsInCategory} tag(s) belong to this category. Please delete or reassign tags first.`,
        },
        { status: 409 }
      )
    }

    await prisma.documentCategory.delete({
      where: { CategoryId: categoryId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting category:", error)
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    )
  }
}

// PUT update category
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { categoryId, name, description } = body

    if (!categoryId) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      )
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      )
    }

    const category = await prisma.documentCategory.update({
      where: { CategoryId: categoryId },
      data: {
        Name: name.trim(),
        Description: description?.trim() || null,
      },
    })

    return NextResponse.json(category)
  } catch (error: any) {
    console.error("Error updating category:", error)
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Category name already exists" },
        { status: 409 }
      )
    }
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    )
  }
}
