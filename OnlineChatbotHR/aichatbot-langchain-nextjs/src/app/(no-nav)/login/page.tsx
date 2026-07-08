"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

const Page = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const username = (e.target as HTMLFormElement).username.value;
    const password = (e.target as HTMLFormElement).password.value;

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Username หรือ Password ไม่ถูกต้อง");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="bg-[url('/login/bg.png')] bg-cover bg-center h-screen w-screen flex flex-col justify-center items-center md:grid md:grid-cols-2 relative">
      {/* Left Side */}
      <div className="flex justify-center items-center">
        <Image
          src="/home/HR_LOGO.png"
          alt="logo"
          width={1000}
          height={1000}
          className="w-2/3"
        />
      </div>

      {/* Divider */}
      <div className="w-[0.5px] h-1/2 absolute top-1/2 left-1/2 bg-white -translate-x-1/2 -translate-y-1/2 hidden md:block" />

      {/* Right Side */}
      <div className="flex flex-col gap-y-5 justify-center items-center w-full px-5">
        <Image
          src="/login/people.png"
          alt="login"
          width={1000}
          height={1000}
          className="w-1/3"
        />

        <form
          className="flex flex-col gap-y-4 w-full md:w-2/5"
          onSubmit={handleSubmit}
        >
          {/* Error Box */}
          {error && (
            <div className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg border border-red-300 animate-in fade-in">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <Input
            placeholder="Username"
            name="username"
            className="bg-white text-black focus:ring-2 focus:ring-blue-400"
            type="text"
          />

          <Input
            placeholder="Password"
            name="password"
            className="bg-white text-black focus:ring-2 focus:ring-blue-400"
            type="password"
          />

          <Button
            type="submit"
            disabled={loading}
            className="transition-all duration-200 hover:scale-[1.02]"
          >
            {loading ? "Loading..." : "Login"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Page;
