"use client";

import { GiHamburgerMenu } from "react-icons/gi";
import { ChevronDown, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Session } from "next-auth";
import UserDropdown from "@/components/UserDropdown";
import NotificationBell from "@/components/NotificationBell";

const sideMenu = [
  {
    url: "/",
    title: "หน้าหลัก",
  },
  {
    url: "/chatbot",
    title: "Chatbot",
  },
  {
    url: "/faq",
    title: "FAQ",
  },
  {
    url: "/documents",
    title: "แบบฟอร์ม/เอกสาร",
  },
  {
    url: "/webfeedback",
    title: "ประเมินความพึงพอใจ",
  },
  {
    url: "/contact",
    title: "ติดต่อเจ้าหน้าที่",
  },
  {
    url: "https://eoffice.kmitl.ac.th/",
    title: "ระบบ e-Office",
  },
  {
    url: "https://lin.ee/mfBaasf",
    title: "เพิ่มเพื่อนใน LINE",
  },
  {
    url: "/dashboard",
    title: "แดชบอร์ด",
    role: ["STAFF", "ADMIN"],
  },
  {
    url: "/management",
    title: "จัดการข้อมูล",
    role: ["ADMIN", "STAFF"],
  },
];

const managementSubMenu = [
  { url: "/management/document", label: "จัดการเอกสารราชการและฟอร์ม" },
  { url: "/management/announcement", label: "จัดการประกาศข่าวสาร" },
  { url: "/management/request-direct", label: "จัดการคำขอสนทนาโดยตรง" },
  { url: "/management/faq", label: "จัดการคำถามที่พบบ่อย" },
  { url: "/management/qaStatic", label: "จัดการคลังคำตอบคงที่" },
  { url: "/management/userAccount", label: "จัดการระบบสิทธิ์เข้าถึง" },
  { url: "/management/staffInfo", label: "ข้อมูลประวัติบุคลากร" },
  { url: "/management/training", label: "การอบรมของบุคลากร" },
  { url: "/management/chat-history", label: "ประวัติการสนทนา" },
];

const dashboardSubMenu = [
  { url: "/dashboard/zoneA", label: "ข้อมูลภาพรวมและจำนวนบุคลากร" },
  { url: "/dashboard/zoneB", label: "การอบรมและพัฒนาทักษะของบุคลากร" },
  { url: "/dashboard/zoneC", label: "ข้อมูลการรับเครื่องราชอิสริยาภรณ์" },
  { url: "/dashboard/zoneD", label: "KPI ตามปีงบประมาณ" },
  { url: "/dashboard/zoneE", label: "KPI ตามปีการศึกษา" },
  { url: "/dashboard/zoneF", label: "การประเมินความพึงพอใจ" },
];

const StaffLayoutProvider = ({ children, session }: { children: React.ReactNode, session: Session | null }) => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openSubMenu, setOpenSubMenu] = useState<"management" | "dashboard" | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/management")) setOpenSubMenu("management");
    else if (pathname.startsWith("/dashboard")) setOpenSubMenu("dashboard");
    // Auto-open sidebar only on homepage AND desktop (lg breakpoint = 1024px)
    const isDesktop = window.innerWidth >= 1024;
    setOpen(pathname === "/" && isDesktop);
  }, [pathname]);

  const hideFooter =
    pathname === "/chatbot" ||
    pathname.startsWith("/chatbot/");

  const isFullHeightPage = hideFooter;

  const publicMenu = sideMenu.filter((item) => !item.role);
  const staffMenu = sideMenu.filter((item) =>
    item.role?.includes(session?.user.role || "")
  );

  const isManagementActive = pathname === "/management" || pathname.startsWith("/management/");
  const isDashboardActive = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 pt-4">
        <div className="text-xl text-gray-400 mb-6 border-b border-gray-300 pb-3">
          Menu
        </div>

        <div className="ml-3">
          {publicMenu.map((item, index) => (
            <div className="mb-4" key={index}>
              <Link
                href={item.url}
                onClick={() => setOpen(false)}
                className={
                  pathname === item.url
                    ? "text-black font-bold"
                    : "text-gray-400"
                }
              >
                {item.title}
              </Link>
            </div>
          ))}

          {staffMenu.length > 0 && (
            <>
              <div className="border-t border-gray-300 my-4 w-3/4" />
              {staffMenu.map((item, index) => (
                <div className="mb-2 group" key={`staff-${index}`}>
                  {item.url === "/management" ? (
                    <>
                      <div className="flex items-center justify-between w-full py-1 pr-2 rounded-sm hover:bg-gray-100/80">
                        <Link
                          href={item.url}
                          onClick={() => setOpen(false)}
                          className={isManagementActive ? "text-black font-bold" : "text-gray-400"}
                        >
                          {item.title}
                        </Link>
                        <button
                          className="lg:hidden p-0.5"
                          onClick={() => setOpenSubMenu(openSubMenu === "management" ? null : "management")}
                          aria-label="Toggle management menu"
                        >
                          {openSubMenu === "management" ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                      <div
                        className={`overflow-hidden transition-[max-height] duration-200 ease-out group-hover:max-h-[500px] ${openSubMenu === "management" ? "max-h-[500px]" : "max-h-0"
                          }`}
                      >
                        <nav className="mt-1 pl-4 border-l-2 border-gray-200 flex flex-col gap-0.5 py-2">
                          {managementSubMenu.map((sub) => (
                            <Link
                              key={sub.url}
                              href={sub.url}
                              onClick={() => setOpen(false)}
                              className={`block py-2 text-sm ${pathname === sub.url || pathname.startsWith(sub.url + "/")
                                  ? "text-black font-medium"
                                  : "text-gray-500 hover:text-gray-800"
                                }`}
                            >
                              {sub.label}
                            </Link>
                          ))}
                        </nav>
                      </div>
                    </>
                  ) : item.url === "/dashboard" ? (
                    <>
                      <div className="flex items-center justify-between w-full py-1 pr-2 rounded-sm hover:bg-gray-100/80">
                        <Link
                          href={item.url}
                          onClick={() => setOpen(false)}
                          className={isDashboardActive ? "text-black font-bold" : "text-gray-400"}
                        >
                          {item.title}
                        </Link>
                        <button
                          className="lg:hidden p-0.5"
                          onClick={() => setOpenSubMenu(openSubMenu === "dashboard" ? null : "dashboard")}
                          aria-label="Toggle dashboard menu"
                        >
                          {openSubMenu === "dashboard" ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                      <div
                        className={`overflow-hidden transition-[max-height] duration-200 ease-out group-hover:max-h-[300px] ${openSubMenu === "dashboard" ? "max-h-[300px]" : "max-h-0"
                          }`}
                      >
                        <nav className="mt-1 pl-4 border-l-2 border-gray-200 flex flex-col gap-0.5 py-2">
                          {dashboardSubMenu.map((sub) => (
                            <Link
                              key={sub.url}
                              href={sub.url}
                              onClick={() => setOpen(false)}
                              className={`block py-2 text-sm ${pathname === sub.url || pathname.startsWith(sub.url + "/")
                                  ? "text-black font-medium"
                                  : "text-gray-500 hover:text-gray-800"
                                }`}
                            >
                              {sub.label}
                            </Link>
                          ))}
                        </nav>
                      </div>
                    </>
                  ) : (
                    <Link
                      href={item.url}
                      onClick={() => setOpen(false)}
                      className={
                        pathname === item.url
                          ? "text-black font-bold"
                          : "text-gray-400"
                      }
                    >
                      {item.title}
                    </Link>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {!session && (
        <div className="border-t border-gray-200 p-5">
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="text-gray-500 hover:text-gray-800 transition-colors leading-relaxed"
          >
            <span className="block font-medium text-base">เข้าสู่ระบบ</span>
            <span className="block text-sm">(สำหรับเจ้าหน้าที่ฝ่ายบุคคล)</span>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-shrink-0 bg-blue-700 p-3 flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/">
            <Image
              src={"/home/logohrit.png"}
              width={100}
              height={30}
              alt={"logo"}
            />
          </Link>
          <button
            className="text-white ml-4 p-1.5 rounded hover:bg-blue-600 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <GiHamburgerMenu className="text-2xl" />
          </button>
        </div>
        <div className="text-white mr-2 flex items-center gap-x-4">
          {session && <NotificationBell />}
          {session && <UserDropdown session={session} />}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop */}
        {open && (
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Sidebar — mobile: fixed overlay drawer; desktop: static inline panel */}
        <aside
          className={[
            "w-64 bg-white border-r-2 border-gray-300 flex-shrink-0",
            "fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out",
            "lg:static lg:h-full lg:z-auto lg:transition-none",
            open ? "translate-x-0" : "-translate-x-full",
            open ? "lg:flex" : "lg:hidden",
          ].join(" ")}
        >
          {isClient ? sidebarContent : (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-6 pt-4">
                <div className="text-xl text-gray-400 mb-6 border-b border-gray-300 pb-3">
                  Menu
                </div>
                <div className="ml-3">
                  {publicMenu.map((item, index) => (
                    <div className="mb-4" key={index}>
                      <Link
                        href={item.url}
                        onClick={() => setOpen(false)}
                        className="text-gray-400"
                      >
                        {item.title}
                      </Link>
                    </div>
                  ))}
                  {staffMenu.length > 0 && (
                    <>
                      <div className="border-t border-gray-300 my-4 w-3/4" />
                      {staffMenu.map((item, index) => (
                        <div className="mb-2 group" key={`staff-${index}`}>
                          <Link
                            href={item.url}
                            onClick={() => setOpen(false)}
                            className="text-gray-400"
                          >
                            {item.title}
                          </Link>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>

        <div className={`flex-1 ${isFullHeightPage ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
          <div className={`${isFullHeightPage ? 'h-full' : 'flex-1 h-full'}`}>
            <div className={`w-full ${isFullHeightPage ? 'h-full' : 'min-h-[85vh]'}`}>{children}</div>
            {!hideFooter && (
              <div className="flex justify-center bg-blueit h-[70px] w-full"></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffLayoutProvider;