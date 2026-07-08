"use client";

import { Phone, Mail, MapPin } from "lucide-react";
import Image from "next/image";

export default function Page() {
  const phone = "02-723-4921";
  const email = "vipada@it.kmitl.ac.th";

  const mailto = `mailto:${email}?subject=${encodeURIComponent(
    "ติดต่อสอบถาม (HR Contact)",
  )}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-5 md:px-10 pt-6 md:pt-10">
        <h1 className="text-2xl md:text-4xl font-extrabold text-blue-700">
          ช่องทางติดต่อเจ้าหน้าที่
        </h1>
        <p className="text-gray-600 font-semibold md:text-lg">HR Contact</p>
      </div>

      <section className="px-5 md:px-10 py-6 md:py-10">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white shadow-lg ring-1 ring-gray-200 p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-6 md:gap-10">
            <div className="flex justify-center md:justify-start">
              <div className="relative aspect-[4/3] w-full max-w-[420px] overflow-hidden rounded-xl bg-gray-100 shadow-inner">
                <Image
                  src="/pkay.jpg"
                  alt="เจ้าหน้าที่ฝ่ายทรัพยากรบุคคล"
                  width={600}
                  height={400}
                  className="object-cover w-full h-full"
                  priority
                />
              </div>
            </div>

            <div className="p-5 md:p-8">
              <div className="flex flex-col justify-start text-gray-700">
                <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">
                  นางสาว วิภาดา ศิลา
                </h2>

                <p className="mt-2 leading-relaxed text-gray-700">
                  นักบริหารทรัพยากรบุคคล ส่วนงานบริหารทรัพยากรบุคคล
                  <br />
                  คณะเทคโนโลยีสารสนเทศ
                  สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
                </p>

                <div className="mt-4 flex items-start gap-3">
                  <MapPin className="mt-1 h-5 w-5 text-gray-700" />
                  <p>อาคารคณะเทคโนโลยีสารสนเทศ สำนักงานคณบดี ชั้น 6</p>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-700" />
                    <a
                      href={`tel:${phone.replace(/[^0-9]/g, "")}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {phone}
                      <span className="sr-only">โทรศัพท์</span>
                    </a>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-700" />
                    <a
                      href={mailto}
                      className="font-medium text-blue-700 hover:underline break-all"
                    >
                      {email}
                      <span className="sr-only">อีเมล</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="px-5 md:px-10 pb-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm text-gray-400 mb-6">หรือ</p>

          <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">
            ติดต่อผ่าน LINE Official
          </h2>

          <p className="mt-2 text-gray-700 leading-relaxed">
            เพิ่มเพื่อนกับ LINE Official Account
            เพื่อพูดคุยและสอบถามข้อมูลกับเจ้าหน้าที่ฝ่ายทรัพยากรบุคคลได้โดยตรง
          </p>

          <div className="mt-6 flex justify-center px-4">
            <a
              href="https://lin.ee/mfBaasf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#06C755] text-white px-5 sm:px-7 py-3 rounded-full font-semibold hover:bg-[#05b14b] transition shadow-md text-sm sm:text-base whitespace-nowrap max-w-full"
            >
              เพิ่มเพื่อนใน LINE
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
