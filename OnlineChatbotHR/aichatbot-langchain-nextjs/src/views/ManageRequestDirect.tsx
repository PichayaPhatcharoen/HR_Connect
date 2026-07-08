"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageCircle } from "lucide-react";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/DataTable/data-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type DirectContactRequestItem = {
  id: string;
  lineUserId: string;
  displayName: string;
  request: string;
  createdAt: string | Date;
  status: string;
};

const statuscolor = (status: string) => {
  switch (status) {
    case "PENDING":
      return "text-[#CC1C1F]"; // แดง
    case "ACCEPTED":
      return "text-green-500"; // เขียว
    case "ENDING":
      return "text-gray-500"; // เทา
    default:
      return "text-gray-700";
  }
};

const getThaiStatus = (status: string) => {
  switch (status) {
    case "PENDING":
      return "รอการยอมรับ";
    case "ACCEPTED":
      return "กำลังสนทนา";
    case "ENDING":
      return "จบการสนทนา";
    default:
      return status;
  }
};

type StatusFilterValue = "all" | "PENDING" | "ACCEPTED" | "ENDING";

const STATUS_FILTER_OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "PENDING", label: "รอการยอมรับ" },
  { value: "ACCEPTED", label: "กำลังสนทนา" },
  { value: "ENDING", label: "จบการสนทนา" },
];

const RequestDirect = () => {
  const queryClient = useQueryClient();
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [page, setPage] = useState(1);

  const { data: onlineStatusData } = useQuery<{ isOnline: boolean }>({
    queryKey: ["user-online-status"],
    queryFn: () => axios.get("/api/user/online-status").then((res) => res.data),
    initialData: { isOnline: false },
  });

  const [isOnline, setIsOnline] = useState<boolean>(onlineStatusData?.isOnline ?? false);

  React.useEffect(() => {
    if (onlineStatusData?.isOnline !== undefined) {
      setIsOnline(onlineStatusData.isOnline);
    }
  }, [onlineStatusData]);

  const { data: response, isFetching } = useQuery<{
    data: DirectContactRequestItem[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>({
    queryKey: ["requests", page, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      return axios.get(`/api/request-direct?${params}`).then((res) => res.data);
    },
    initialData: { data: [], pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 } },
    refetchInterval: 10_000,
  });
  const requests = response?.data ?? [];
  const pagination = response?.pagination ?? { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 };

  const { mutateAsync: updateStatus, isPending } = useMutation({
    mutationFn: (data: { id: string; status: string }) =>
      axios.put("/api/request-direct/status", data),
    onMutate: (data) => {
      setMutatingId(data.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
    onSettled: () => {
      setMutatingId(null);
    },
  });

  const { mutateAsync: updateOnlineStatus } = useMutation({
    mutationFn: (isOnline: boolean) =>
      axios.put("/api/user/online-status", { isOnline }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-online-status"] });
    },
    onError: (error, newStatus) => {
      console.error("Failed to update online status:", error);
      setIsOnline(!newStatus);
    },
  });

  const handleToggleOnlineStatus = async () => {
    const newStatus = !isOnline;
    const previousStatus = isOnline;

    setIsOnline(newStatus);
    try {
      await updateOnlineStatus(newStatus);
    } catch (error) {
      setIsOnline(previousStatus);
      console.error("Failed to update online status:", error);
    }
  };


  const LINE_CHAT_URL = "https://chat.line.biz/account/@143thesr";

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter]);


  const handleUpdateStatus = async (id: string, status: string) => {
    if (isPending) return;
    try {
      console.log("Updating status:", id, status);
      await updateStatus({ id, status });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const endItem = Math.min(pagination.page * pagination.pageSize, pagination.total);

  const getButton = (status: string, id: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Button
            variant="outline"
            className="bg-[#0FB848] text-white text-sm px-3 py-1"
            onClick={() => handleUpdateStatus(id, "ACCEPTED")}
            disabled={isPending && mutatingId === id}
          >
            {isPending && mutatingId === id ? "Accepting..." : "Accept"}
          </Button>
        );
      case "ACCEPTED":
        return (
          <Button
            variant="outline"
            className="bg-[#BD1A1A] text-white text-sm px-3 py-1"
            onClick={() => handleUpdateStatus(id, "ENDING")}
            disabled={isPending && mutatingId === id}
          >
            {isPending && mutatingId === id ? "Ending..." : "End Chat"}
          </Button>
        );
      default:
        return undefined;
    }
  };

  const columns: ColumnDef<DirectContactRequestItem>[] = [
    {
      header: () => <span className="text-base font-semibold">คำถาม</span>,
      accessorKey: "request",
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="text-sm min-w-0 break-words whitespace-normal block max-w-xs">{getValue() as string}</span>
      ),
    },
    {
      header: () => <span className="text-base font-semibold">เจ้าของคำขอ</span>,
      accessorKey: "displayName",
      enableSorting: false,
      cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span>,
    },
    {
      header: () => <span className="text-base font-semibold">เวลาส่งคำขอ</span>,
      accessorKey: "createdAt",
      cell: ({ row }) => {
        const createdAt = row.getValue("createdAt") as string | Date | undefined;
        const date = createdAt ? new Date(createdAt) : null;
        const formattedDate =
          date && !Number.isNaN(date.getTime())
            ? date.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
            : "—";
        return <span className="text-sm">{formattedDate}</span>;
      },
    },
    {
      header: () => <span className="text-base font-semibold">สถานะ</span>,
      accessorKey: "status",
      enableSorting: false,
      cell: ({ row }) => {
        const thaistatus = row.getValue("status") as string;
        return (
          <div className={cn("text-sm font-medium", statuscolor(thaistatus))}>
            {getThaiStatus(thaistatus)}
          </div>
        );
      },
    },
    {
      header: "",
      accessorKey: "action",
      enableSorting: false,
      cell: ({ row }) => {
        const id = row.original.id;
        const status = row.getValue("status") as string;
        return getButton(status, id);
      },
    },
  ];

  return (
    <div className="min-h-screen p-8 bg-gray-50 text-lg">
      <div className="flex flex-col gap-y-1 mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-blue-600">
          จัดการคำขอสนทนาโดยตรง
        </h1>
        <p className="text-black text-lg font-bold">
          Direct Chat Requests Management
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-bold text-gray-900">คำขอล่าสุด</p>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilterValue)}
            >
              <SelectTrigger className="w-full md:w-[200px] text-base border-2 border-gray-300 focus:border-blue-500 focus-visible:ring-0 min-h-[2.5rem]">
                <SelectValue placeholder="กรองตามสถานะ" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-base">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusFilter !== "all" && (
              <span className="text-base text-gray-600">
                แสดง {pagination.total} รายการ
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              className="bg-[#06C755] hover:bg-[#05b04c] text-white text-sm sm:text-base min-h-[2.5rem] px-3 whitespace-nowrap"
            >
              <a href={LINE_CHAT_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-2" />
                เปิด LINE Chat
              </a>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-xl font-bold">รายการคำขอ</p>
            <div className="flex items-center gap-3">
              <span className="text-base text-gray-700">
                {isOnline ? "ตอนนี้กำลังแสดงสถานะออนไลน์แก่ผู้ใช้งาน" : "ตอนนี้กำลังแสดงสถานะออฟไลน์แก่ผู้ใช้งาน"}
              </span>
              <button
                onClick={handleToggleOnlineStatus}
                className={`relative w-24 h-10 rounded-full transition-all duration-300 ease-in-out ${isOnline ? "bg-green-500" : "bg-gray-400"
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 ${isOnline ? "focus:ring-green-500" : "focus:ring-gray-400"
                  }`}
              >
                <div
                  className={`absolute top-1 w-8 h-8 bg-white rounded-full shadow-md transition-all duration-300 ease-in-out ${isOnline ? "left-[calc(100%-2.25rem)]" : "left-1"
                    }`}
                />
              </button>
            </div>
          </div>

          {isFetching && requests.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              <DataTable columns={columns} data={requests} initialSorting={[{ id: "createdAt", desc: true }]} className="text-base [&_th]:py-2 [&_td]:py-2 [&_th]:text-base [&_td]:text-base" />
              {pagination.totalPages > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-base text-gray-600 mb-3">
                    แสดง {startItem}-{endItem} จาก {pagination.total} รายการ
                  </p>
                  <div className="flex justify-center items-center gap-2">
                    <Button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page <= 1 || isFetching}
                      variant="outline"
                      className="text-base min-h-[2.5rem] px-3"
                    >
                      ก่อนหน้า
                    </Button>
                    <span className="text-base text-gray-600">
                      หน้า {pagination.page} จาก {pagination.totalPages}
                    </span>
                    <Button
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={pagination.page >= pagination.totalPages || isFetching}
                      variant="outline"
                      className="text-base min-h-[2.5rem] px-3"
                    >
                      ถัดไป
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestDirect;
