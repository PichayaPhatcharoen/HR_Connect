"use client";

import React, { useState, FormEvent, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useRef } from "react";

type User = {
  id: string;
  name: string;
  title: string;
  picture: string | null;
  email: string;
  phone: string;
  username: string;
  role: string;
};

const Page = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("id");

  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) {
        setLoadError("ไม่พบ ID บัญชีที่ต้องการแก้ไข");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const res = await fetch(`/api/user/${userId}`);
        if (res.status === 404) {
          setLoadError("ไม่พบข้อมูลบัญชีที่เลือก");
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to fetch user");
        }
        const data: User = await res.json();

        setTitle(data.title);
        setName(data.name);
        setUsername(data.username);
        setEmail(data.email);
        setPhone(data.phone);
        setRole(data.role as "ADMIN" | "STAFF");
        if (data.picture) {
          // If picture is a path (starts with users/), prepend / to make it absolute
          setImagePreview(data.picture.startsWith("/") ? data.picture : `/${data.picture}`);
        }
        setLoadError(null);
      } catch (err) {
        console.error("Failed to load user:", err);
        setLoadError("ไม่สามารถโหลดข้อมูลบัญชีได้");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!userId) {
      setErrorMessage("ไม่พบ ID บัญชีที่ต้องการแก้ไข");
      return;
    }

    // เช็คว่ากรอกข้อมูลครบไหม (password และรูปภาพไม่จำเป็นสำหรับการแก้ไข)
    if (!title.trim() || !name.trim() || !username.trim() || !email.trim() || !phone.trim()) {
      setErrorMessage("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    const confirmed = window.confirm("ยืนยันการบันทึกการแก้ไขหรือไม่?");
    if (!confirmed) return;

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Create FormData
      const formData = new FormData();
      formData.append("title", title);
      formData.append("name", name);
      formData.append("username", username);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("role", role);
      
      // เพิ่ม password เฉพาะเมื่อมีการกรอก
      if (password.trim()) {
        formData.append("password", password);
      }

      // เพิ่มรูปภาพถ้ามีการอัปโหลดรูปใหม่
      if (profileImage) {
        formData.append("file", profileImage);
      }

      const response = await fetch(`/api/user/${userId}`, {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setErrorMessage(data?.error || "ไม่สามารถบันทึกข้อมูลได้");
        return;
      }

      window.alert("บันทึกข้อมูลเรียบร้อย");
      router.push("/management/userAccount");
      router.refresh();
    } catch (err) {
      console.error(err);
      setErrorMessage("เกิดข้อผิดพลาด ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!userId) {
      setErrorMessage("ไม่พบ ID บัญชีที่ต้องการลบ");
      return;
    }

    const confirmed = window.confirm(
      "คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีนี้? การกระทำนี้ไม่สามารถยกเลิกได้"
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/user/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setErrorMessage(data?.error || "ไม่สามารถลบข้อมูลได้");
        return;
      }

      window.alert("ลบข้อมูลเรียบร้อย");
      router.push("/management/userAccount");
      router.refresh();
    } catch (err) {
      console.error(err);
      setErrorMessage("เกิดข้อผิดพลาด ไม่สามารถลบข้อมูลได้");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-blueit mb-2">
            แก้ไขบัญชีและสิทธิ์การเข้าถึง
          </h1>
          <p className="text-gray-700 text-lg font-semibold">
            คณะเทคโนโลยีสารสนเทศ
            <br />
            สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : loadError ? (
          <div className="text-center py-12">
            <p className="text-red-500 text-lg">{loadError}</p>
            <Link href="/management/userAccount">
              <button className="mt-4 bg-gray-300 text-black hover:bg-gray-400 px-6 py-3 rounded-xl font-semibold">
                ย้อนกลับ
              </button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-6">
              <div>
                <label className="block text-lg font-semibold mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <Select value={title} onValueChange={setTitle} disabled={isSubmitting || isDeleting}>
                  <SelectTrigger className="w-full p-3 border-2 border-gray-300 focus:border-blue-500">
                    <SelectValue placeholder="เลือกคำนำหน้าชื่อ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MR">นาย</SelectItem>
                    <SelectItem value="MRS">นาง</SelectItem>
                    <SelectItem value="MISS">นางสาว</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="name" className="block text-lg font-semibold mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="name"
                  className="w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="กรอกชื่อ-นามสกุล"
                  disabled={isSubmitting || isDeleting}
                  required
                />
              </div>

              <div>
                <label htmlFor="username" className="block text-lg font-semibold mb-2">
                  Username <span className="text-red-500">*</span>
                </label>
                <Input
                  id="username"
                  className="w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="กรอก Username"
                  disabled={isSubmitting || isDeleting}
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-lg font-semibold mb-2">
                  Password <span className="text-gray-500 text-sm">(ถ้าต้องการเปลี่ยน)</span>
                </label>
                <Input
                  id="password"
                  type="password"
                  className="w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอก Password ใหม่"
                  disabled={isSubmitting || isDeleting}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-lg font-semibold mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  id="email"
                  type="email"
                  className="w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="กรอก Email"
                  disabled={isSubmitting || isDeleting}
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-lg font-semibold mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <Input
                  id="phone"
                  type="tel"
                  className="w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="กรอกเบอร์โทรศัพท์"
                  disabled={isSubmitting || isDeleting}
                  required
                />
              </div>
            </div>

            <div className="w-full md:w-64 flex flex-col gap-y-6">
              <div className="flex flex-col gap-y-2">
                <label className="block text-lg font-semibold mb-2">
                  Profile Picture
                </label>
                <div
                  onClick={handleImageClick}
                  className="w-full aspect-square bg-gray-100 border border-gray-300 rounded-sm flex items-center justify-center cursor-pointer hover:bg-gray-200 transition"
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Profile preview"
                      className="w-full h-full object-cover rounded-sm"
                    />
                  ) : (
                    <div className="rounded-full border-2 border-gray-400 p-2">
                      <Plus className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={isSubmitting || isDeleting}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-y-2 mt-3 md:mt-6 ml-5">
                <label className="block text-lg font-semibold mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <RadioGroup
                  value={role}
                  onValueChange={(v) => setRole(v as "ADMIN" | "STAFF")}
                  className="flex flex-col gap-4 mt-2"
                  disabled={isSubmitting || isDeleting}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="STAFF"
                      id="role-STAFF"
                      className="w-5 h-5"
                    />
                    <Label htmlFor="role-STAFF" className="text-base cursor-pointer">
                      HR Staff
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="ADMIN"
                      id="role-ADMIN"
                      className="w-5 h-5"
                    />
                    <Label htmlFor="role-ADMIN" className="text-base cursor-pointer">
                      Admin
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>

          {errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}

            <div className="pt-4 flex items-center justify-between">
              <Link href="/management/userAccount">
                <button
                  type="button"
                  className="bg-gray-300 text-black hover:bg-gray-400 px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
                  disabled={isSubmitting || isDeleting}
                >
                  ย้อนกลับ
                </button>
              </Link>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="bg-red-600 text-white hover:bg-red-700 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting || isDeleting}
                  aria-busy={isDeleting}
                >
                  {isDeleting && (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {isDeleting ? "กำลังลบ" : "ลบ"}
                </button>
                <button
                  type="submit"
                  className="bg-blueit text-white hover:bg-blue-800 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting || isDeleting}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting && (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {isSubmitting ? "กำลังบันทึก" : "บันทึก"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Page;
