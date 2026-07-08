"use client"
 
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table"
 
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import * as React from "react"
 
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  className?: string
  initialSorting?: SortingState
}

export function DataTable<TData, TValue>({
    columns,
    data,
    className,
    initialSorting,
  }: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>(initialSorting ?? [])
    const table = useReactTable({
      data,
      columns,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      onSortingChange: setSorting,
      enableSortingRemoval: false,
      state: {
        sorting,
      },
    })
    return  (
        <Table className={cn("text-base", className)}>
            <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                    // สร้างแถวมาสำหรับใส่ข้อมูล
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header, id) => 
                        { 
                            const canSort = header.column.getCanSort()
                            const sorted = header.column.getIsSorted()
                            return  (
                                // เอาชื่อ header มาใส่
                                <TableHead
                                  key={id}
                                  onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                                  className={cn(
                                    canSort && "cursor-pointer select-none",
                                    sorted && "text-blueit"
                                  )}
                                >
                                    {header.isPlaceholder ? null : (
                                      <div className="flex items-center gap-1">
                                        <span>
                                          {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                          )}
                                        </span>
                                        {canSort && (
                                          <span className="text-gray-400">
                                            {sorted === "asc" ? "↑" : "↓"}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                </TableHead>
                            )
                        })}
                    </TableRow>
                ))}
            </TableHeader>
            <TableBody>
                {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, id) => (
                    <TableRow key={id}>
                        {row.getVisibleCells().map((cell, id) => (
                            <TableCell key={id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                    </TableRow>
                ))):(
                <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">ไม่พบข้อมูล</TableCell>
                </TableRow> )}

            </TableBody>
        </Table>
    )
}