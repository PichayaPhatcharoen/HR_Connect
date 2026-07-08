"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Session } from "next-auth";
import { FaUser } from "react-icons/fa6";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

type Props = {
    session: Session;
}

const UserDropdown = ({ session }: Props) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center text-base">
        <FaUser /> <span className="ml-3">{session.user.username}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center text-base"><FaUser /> <span className="ml-3">{session.user.username}</span></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => signOut()}>ออกจากระบบ</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserDropdown;
