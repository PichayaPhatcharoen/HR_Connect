"use client";

import React, { useMemo, useCallback } from "react";
import Image from "next/image";
import HomeImageSlide from "@/components/HomeImageSlide";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { shouldBypassImageOptimization } from "@/lib/publicUploadedImage";

type AnnouncementItem = {
  id: string;
  title: string | null;
  content: string | null;
  picture: string | null;
  link: string | null;
  position?: string;
  status?: string;
  isLatest?: boolean;
};

const AnnouncementBoard = () => {
  const { data: announcements = [], isLoading, isError } = useQuery<AnnouncementItem[]>({
    queryKey: ["announcements"],
    queryFn: () => axios.get("/api/announcement").then((res) => res.data),
    initialData: [],
  });

  const buildSrc = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (path.startsWith("/")) return path;
    return `/${path}`;
  };

  const byPosition = useCallback(
    (pos: string) => (announcements || []).filter((a) => a.position === pos),
    [announcements]
  );

  const topSlides = useMemo(
    () =>
      byPosition("TOP")
        .filter((a) => a.picture && a.picture.trim().length > 0)
        .map((a) => ({
          id: a.id,
          src: buildSrc(a.picture ?? ""),
          alt: a.title || `announcement-${a.id}`,
          link: a.link ?? null,
        })),
    [byPosition]
  );

  const leftSlides = useMemo(
    () =>
      byPosition("LEFT")
        .filter((a) => a.picture && a.picture.trim().length > 0)
        .map((a) => ({
          id: a.id,
          src: buildSrc(a.picture ?? ""),
          alt: a.title || `announcement-${a.id}`,
          title: a.title,
          link: a.link ?? null,
        })),
    [byPosition]
  );

  const rightSlides = useMemo(
    () =>
      byPosition("RIGHT")
        .filter((a) => a.picture && a.picture.trim().length > 0)
        .map((a) => ({
          id: a.id,
          src: buildSrc(a.picture ?? ""),
          alt: a.title || `announcement-${a.id}`,
          title: a.title,
          link: a.link ?? null,
        })),
    [byPosition]
  );

  const mobileCombinedSlides = useMemo(() => {
    return [...leftSlides, ...rightSlides].slice(0, 6);
  }, [leftSlides, rightSlides]);

  const middleSlides = useMemo(
    () =>
      byPosition("MIDDLE")
        .filter((a) => a.picture && a.picture.trim().length > 0)
        .map((a) => ({
          id: a.id,
          src: buildSrc(a.picture ?? ""),
          alt: a.title || `announcement-${a.id}`,
          title: a.title,
          link: a.link ?? null,
        })),
    [byPosition]
  );

  const latestTitles = useMemo(
    () =>
      (announcements || [])
        .filter((a) => a.isLatest && a.title && a.title.trim().length > 0)
        .slice(0, 5)
        .map((a) => ({ id: a.id, title: a.title })),
    [announcements]
  );


  return (
    <>
      <div className="w-full grid grid-cols-7 scroll-m-16" id="announcement">
        <div className="w-full col-span-7 px-4 md:col-start-2 md:col-span-5 md:px-0">
          <div className="w-full mb-4">
            <HomeImageSlide slides={topSlides} />
          </div>

          <div className="block md:hidden px-4 mt-4">
            <h2 className="text-2xl font-bold mb-4">ประกาศล่าสุด</h2>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                <div className="w-full h-6 bg-gray-200 animate-pulse rounded"></div>
                <div className="w-full h-6 bg-gray-200 animate-pulse rounded"></div>
                <div className="w-full h-6 bg-gray-200 animate-pulse rounded"></div>
              </div>
            ) : isError ? (
              <p className="text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
            ) : latestTitles.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {latestTitles.map((a) => (
                  <li key={a.id} className="w-full">
                    <Link href={`/announce?id=${a.id}`}>
                      <p className="text-base text-blue-700 hover:underline">{a.title}</p>
                    </Link>
                    <hr />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">ยังไม่มีประกาศ</p>
            )}
          </div>

          <div className="block md:hidden px-4 mt-4">
            {isLoading ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="w-full h-28 bg-gray-200 animate-pulse rounded" />
                <div className="w-full h-28 bg-gray-200 animate-pulse rounded" />
                <div className="w-full h-28 bg-gray-200 animate-pulse rounded" />
              </div>
            ) : isError ? (
              <p className="text-red-500">โหลดข้อมูลไม่สำเร็จ</p>
            ) : mobileCombinedSlides.length ? (
              <div className="grid grid-cols-3 gap-2">
                {mobileCombinedSlides.map((a) => {
                  const imgBlock = (
                    <div className="relative w-full aspect-[4/5] overflow-hidden shadow">
                      <Image
                        src={a.src}
                        alt={a.alt}
                        fill
                        className="object-cover"
                        sizes="150px"
                        unoptimized={shouldBypassImageOptimization(a.src)}
                      />
                    </div>
                  );
                  return (
                    <div key={a.id}>
                      {a.link?.trim() ? (
                        <a
                          href={a.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          {imgBlock}
                        </a>
                      ) : (
                        <Link href={`/announce?id=${a.id}`}>{imgBlock}</Link>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="hidden md:block md:col-span-1">
              {isLoading ? (
                <div className="flex flex-col gap-2 mt-4 px-4 md:px-0">
                  <div className="w-full h-32 bg-gray-200 animate-pulse rounded" />
                  <div className="w-full h-32 bg-gray-200 animate-pulse rounded" />
                </div>
              ) : isError ? (
                <p className="text-red-500 mt-4 px-4 md:px-0">โหลดข้อมูลไม่สำเร็จ</p>
              ) : leftSlides.length ? (
                <div className="flex flex-col gap-3 mt-4 px-4 md:px-0">
                  {leftSlides.map((a) => {
                    const imgBlock = (
                      <div className="relative w-full aspect-[4/5] overflow-hidden shadow">
                        <Image
                          src={a.src}
                          alt={a.alt}
                          fill
                          className="object-cover"
                          sizes="300px"
                          unoptimized={shouldBypassImageOptimization(a.src)}
                        />
                      </div>
                    );
                    return (
                      <div key={a.id}>
                        {a.link?.trim() ? (
                          <a
                            href={a.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            {imgBlock}
                          </a>
                        ) : (
                          <Link href={`/announce?id=${a.id}`}>{imgBlock}</Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* desktop */}
            <div className="hidden md:block md:col-span-3">
              <h2 className="text-2xl md:text-3xl font-bold px-4 md:px-0">ประกาศล่าสุด</h2>

              {isLoading ? (
                <div className="flex flex-col gap-2 mt-4 px-4 md:px-0">
                  <div className="w-full h-6 bg-gray-200 animate-pulse rounded"></div>
                  <div className="w-full h-6 bg-gray-200 animate-pulse rounded"></div>
                  <div className="w-full h-6 bg-gray-200 animate-pulse rounded"></div>
                </div>
              ) : isError ? (
                <p className="text-red-500 mt-4 px-4 md:px-0">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
              ) : latestTitles.length > 0 ? (
                <ul className="flex flex-col gap-2 mt-4 px-4 md:px-0">
                  {latestTitles.map((a) => (
                    <li key={a.id} className="w-full">
                      <Link href={`/announce?id=${a.id}`}>
                        <p className="text-base md:text-lg text-blue-700 hover:underline">{a.title}</p>
                      </Link>
                      <hr />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 mt-4 px-4 md:px-0">ยังไม่มีประกาศ</p>
              )}
            </div>

            <div className="hidden md:block md:col-span-1">
              {isLoading ? (
                <div className="flex flex-col gap-2 mt-4 px-4 md:px-0">
                  <div className="w-full h-32 bg-gray-200 animate-pulse rounded" />
                  <div className="w-full h-32 bg-gray-200 animate-pulse rounded" />
                </div>
              ) : isError ? (
                <p className="text-red-500 mt-4 px-4 md:px-0">โหลดข้อมูลไม่สำเร็จ</p>
              ) : rightSlides.length ? (
                <div className="flex flex-col gap-3 mt-4 px-4 md:px-0">
                  {rightSlides.map((a) => {
                    const imgBlock = (
                      <div className="relative w-full aspect-[4/5] overflow-hidden shadow">
                        <Image
                          src={a.src}
                          alt={a.alt}
                          fill
                          className="object-cover"
                          sizes="300px"
                          unoptimized={shouldBypassImageOptimization(a.src)}
                        />
                      </div>
                    );
                    return (
                      <div key={a.id}>
                        {a.link?.trim() ? (
                          <a
                            href={a.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            {imgBlock}
                          </a>
                        ) : (
                          <Link href={`/announce?id=${a.id}`}>{imgBlock}</Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          {/* MIDDLE */}
          <div className="w-full mt-6">
            {isLoading ? (
              <div className="flex flex-col gap-2 mt-4 px-4 md:px-0">
                <div className="w-full h-40 bg-gray-200 animate-pulse rounded" />
                <div className="w-full h-40 bg-gray-200 animate-pulse rounded" />
              </div>
            ) : isError ? (
              <p className="text-red-500 mt-4 px-4 md:px-0">โหลดข้อมูลไม่สำเร็จ</p>
            ) : middleSlides.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 px-4 md:px-0">
                {middleSlides.map((a) => {
                  const imgBlock = (
                    <div className="relative w-full aspect-[4/5] overflow-hidden shadow">
                      <Image
                        src={a.src}
                        alt={a.alt}
                        fill
                        className="object-cover"
                        sizes="600px"
                        unoptimized={shouldBypassImageOptimization(a.src)}
                      />
                    </div>
                  );
                  return (
                    <div key={a.id}>
                      {a.link?.trim() ? (
                        <a
                          href={a.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          {imgBlock}
                        </a>
                      ) : (
                        <Link href={`/announce?id=${a.id}`}>{imgBlock}</Link>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="w-full mt-8 flex flex-col gap-3 md:hidden">
            <Link href={"/chatbot"} className="block w-full">
              <div className="relative w-full aspect-[16/5] max-h-[160px] sm:max-h-[200px] overflow-hidden">
                <Image
                  src={"/home/home1.png"}
                  alt={"pichome1"}
                  fill
                  className="object-contain"
                  sizes="(max-width: 640px) 100vw, 900px"
                />
              </div>
            </Link>

            <Link
              href={
                "https://www.hr.kmitl.ac.th/2020/06/30/%e0%b8%a3%e0%b8%b0%e0%b9%80%e0%b8%9a%e0%b8%b5%e0%b8%a2%e0%b8%9a-%e0%b8%82%e0%b9%89%e0%b8%ad%e0%b8%9a%e0%b8%b1%e0%b8%87%e0%b8%84%e0%b8%b1%e0%b8%9a/"
              }
              className="block w-full"
            >
              <div className="relative w-full aspect-[16/5] max-h-[160px] sm:max-h-[200px] overflow-hidden">
                <Image
                  src={"/home/home2.png"}
                  alt={"pichome2"}
                  fill
                  className="object-contain"
                  sizes="(max-width: 640px) 100vw, 900px"
                />
              </div>
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link href={"/documents"} className="block">
                <div className="relative w-full aspect-[16/10] max-h-[160px] sm:max-h-[200px] overflow-hidden rounded-sm">
                  <Image
                    src={"/home/home3.png"}
                    alt={"pichome3"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 450px"
                  />
                </div>
              </Link>
              <Link
                href={
                  "https://drive.google.com/file/d/1Udl1zBQdRoUaGV7mbxYGCj2RoWzXQ9t5/view"
                }
                className="block"
              >
                <div className="relative w-full aspect-[16/10] max-h-[140px] sm:max-h-[180px] overflow-hidden rounded-sm shadow">
                  <Image
                    src={"/home/emp_handbook2.png"}
                    alt={"pichome4"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 450px"
                  />
                </div>
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Link href={"/faq"} className="block">
                <div className="relative w-full aspect-square overflow-hidden">
                  <Image
                    src={"/home/faq.png"}
                    alt={"faq"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, 200px"
                  />
                </div>
              </Link>

              <Link href={"/documents"} className="block">
                <div className="relative w-full aspect-square overflow-hidden">
                  <Image
                    src={"/home/doc.png"}
                    alt={"documents"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, 200px"
                  />
                </div>
              </Link>

              <Link href={"/contact"} className="block">
                <div className="relative w-full aspect-square overflow-hidden">
                  <Image
                    src={"/home/direct.png"}
                    alt={"direct-contact"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, 200px"
                  />
                </div>
              </Link>
            </div>
          </div>

          {/* Desktop layout*/}
          <div className="hidden w-full md:grid grid-cols-5 gap-4 mt-8">
            <Link className="w-full col-span-4" href={"/chatbot"}>
              <Image
                src={"/home/home1.png"}
                width={1000}
                height={1000}
                alt={"pichome1"}
                className="w-full h-full object-cover"
              />
            </Link>
            <Link
              href={"/faq"}
              className="flex h-full w-full items-center justify-center text-center"
            >
              <Image
                src={"/home/faq.png"}
                width={1000}
                height={1000}
                alt={"pichome2"}
                className="w-full h-full object-cover rounded-sm shadow"
              />
            </Link>
            <Link
              href={"https://www.hr.kmitl.ac.th/2020/06/30/%e0%b8%a3%e0%b8%b0%e0%b9%80%e0%b8%9a%e0%b8%b5%e0%b8%a2%e0%b8%9a-%e0%b8%82%e0%b9%89%e0%b8%ad%e0%b8%9a%e0%b8%b1%e0%b8%87%e0%b8%84%e0%b8%b1%e0%b8%9a/"}
              className="w-full h-auto col-span-4"
            >
              <Image
                src={"/home/home2.png"}
                width={1000}
                height={1000}
                alt={"pichome2"}
                className="w-full h-full object-cover"
              />
            </Link>
            <Link
              href={"/documents"}
              className="flex h-full w-full items-center justify-center text-center"
            >
              <Image
                src={"/home/doc.png"}
                width={1000}
                height={1000}
                alt={"pichome2"}
                className="w-full h-full object-cover rounded-sm shadow"
              />
            </Link>
            <Link
              className="w-full h-auto col-span-2 rounded-sm"
              href={"https://www.hr.kmitl.ac.th/2020/07/31/%e0%b8%a3%e0%b8%b1%e0%b8%9a%e0%b8%aa%e0%b8%a1%e0%b8%b1%e0%b8%84%e0%b8%a3%e0%b8%87%e0%b8%b2%e0%b8%99/"}
            >
              <Image
                src={"/home/home3.png"}
                width={1000}
                height={1000}
                alt={"pichome3"}
              />
            </Link>
            <Link
              className="w-full h-auto col-span-2 rounded-sm"
              href={"https://www.hr.kmitl.ac.th/wp-content/uploads/2026/01/info-%E0%B8%84%E0%B8%B9%E0%B9%88%E0%B8%A1%E0%B8%B7%E0%B8%AD-%E0%B8%9E%E0%B8%99%E0%B8%87-%E0%B9%83%E0%B8%AB%E0%B8%A1%E0%B9%88-Rev-10_19.1.26.pdf"}
            >
              <Image
                src={"/home/emp_handbook2.png"}
                width={1000}
                height={1000}
                alt={"pichome4"}
              /></Link>

            <Link
              href={"/contact"}
              className="flex h-full w-full items-center justify-center text-center"
            >
              <Image
                src={"/home/direct.png"}
                width={1000}
                height={1000}
                alt={"pichome2"}
                className="w-full h-full object-cover rounded-sm shadow"
              />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default AnnouncementBoard;
