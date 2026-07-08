"use client";

import React, { useState, FormEvent } from "react";
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
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useRef } from "react";

const Page = () => {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // เช็คว่ากรอกข้อมูลครบไหม (รูปภาพไม่จำเป็น)
    if (!title.trim() || !name.trim() || !username.trim() || !password.trim() || !email.trim() || !phone.trim()) {
      setErrorMessage("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    const confirmed = window.confirm("ยืนยันการบันทึกข้อมูลหรือไม่?");
    if (!confirmed) return;

    if (isPending) return;

    setIsPending(true);
    try {
      // Create FormData
      const formData = new FormData();
      formData.append("title", title);
      formData.append("name", name);
      formData.append("username", username);
      formData.append("password", password);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("role", role);
      
      // Add image file if provided
      if (profileImage) {
        formData.append("file", profileImage);
      }

      const response = await fetch("/api/signup", {
        method: "POST",
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
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-blueit mb-2">
            เพิ่มบัญชีและสิทธิ์การเข้าถึง
          </h1>
          <p className="text-gray-700 text-lg font-semibold">
            คณะเทคโนโลยีสารสนเทศ
            <br />
            สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-6">
              <div>
                <label className="block text-lg font-semibold mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <Select value={title} onValueChange={setTitle}>
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
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-lg font-semibold mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <Input
                  id="password"
                  type="password"
                  className="w-full p-3 border-2 border-gray-300 focus:border-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอก Password"
                  required
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
                    disabled={isPending}
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
                disabled={isPending}
              >
                ย้อนกลับ
              </button>
            </Link>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="bg-blueit text-white hover:bg-blue-800 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isPending}
                aria-busy={isPending}
              >
                {isPending && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {isPending ? "กำลังบันทึก" : "บันทึก"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Page;
