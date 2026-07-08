"use client";

import { useEffect, useState } from "react";
import { IoNotificationsOutline } from "react-icons/io5";

type Contract = {
  ContractId: string;
  EndDate: string;
  ReadByHR: boolean;
  Employee: {
    FullName: string;
  };
};

type RetirementRow = {
  PositionId: string;
  EmployeeId: string;
  RetirementDate: string;
  ReadByHR: boolean;
  FullName: string;
};

export default function NotificationBell() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [retirements, setRetirements] = useState<RetirementRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const [contractRes, retirementRes] = await Promise.all([
          fetch("/api/contract/contract-expiring"),
          fetch("/api/employees/retirement-upcoming"),
        ]);
        const contractData = await contractRes.json();
        const retirementData = await retirementRes.json();

        setContracts(contractData.data || []);
        setRetirements(retirementData.data || []);
        setUnreadCount(
          (contractData.count || 0) + (retirementData.count || 0)
        );
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      }
    };

    fetchNotifications();
  }, []);

  const markAllAsRead = async () => {
    const unreadContractIds = contracts
      .filter((n) => !n.ReadByHR)
      .map((n) => n.ContractId);
    const unreadRetirementIds = retirements
      .filter((n) => !n.ReadByHR)
      .map((n) => n.PositionId);

    try {
      if (unreadContractIds.length > 0) {
        await fetch("/api/contract/notifications-read-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: unreadContractIds }),
        });
      }
      if (unreadRetirementIds.length > 0) {
        await fetch("/api/employees/retirement-notifications-read-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: unreadRetirementIds }),
        });
      }

      setUnreadCount(0);
      setContracts((prev) =>
        prev.map((n) => ({ ...n, ReadByHR: true }))
      );
      setRetirements((prev) =>
        prev.map((n) => ({ ...n, ReadByHR: true }))
      );
    } catch (err) {
      console.error("Failed to mark notifications", err);
    }
  };

  const toggleBell = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      await markAllAsRead();
    }
  };

  return (
    <div className="relative">
      <div
        className="cursor-pointer relative"
        onClick={toggleBell}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            void toggleBell();
          }
        }}
        aria-label="การแจ้งเตือน"
      >
        <IoNotificationsOutline className="text-2xl text-white" />

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full px-1.5">
            {unreadCount}
          </span>
        )}
      </div>

      {open && (
        <div className="absolute right-0 mt-3 w-80 max-h-[min(70vh,28rem)] overflow-y-auto bg-white text-black rounded-lg shadow-lg border z-50">
          <div className="p-3 border-b font-semibold text-sm text-gray-700">
            การแจ้งเตือน
          </div>

          <div className="p-2 border-b">
            <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              สัญญาใกล้สิ้นสุด
            </div>
            {contracts.length === 0 ? (
              <div className="px-2 py-2 text-sm text-gray-500">ไม่มีรายการ</div>
            ) : (
              contracts.map((n) => (
                <div
                  key={n.ContractId}
                  className="p-2 rounded hover:bg-gray-50"
                >
                  <div className="font-medium text-sm">{n.Employee.FullName}</div>
                  <div className="text-xs text-gray-500">
                    หมดสัญญา{" "}
                    {new Date(n.EndDate).toLocaleDateString("th-TH")}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-2">
            <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              วันเกษียณอายุ
            </div>
            {retirements.length === 0 ? (
              <div className="px-2 py-2 text-sm text-gray-500">ไม่มีรายการ</div>
            ) : (
              retirements.map((n) => (
                <div
                  key={n.PositionId}
                  className="p-2 rounded hover:bg-gray-50"
                >
                  <div className="font-medium text-sm">{n.FullName}</div>
                  <div className="text-xs text-gray-500">
                    เกษียณอายุ{" "}
                    {new Date(n.RetirementDate).toLocaleDateString("th-TH")}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}
    </div>
  );
}
