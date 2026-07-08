'use client';

import React, { useState, useEffect } from 'react';
import { Mail } from 'lucide-react';
import Link from 'next/link';
import { FaCirclePlus } from 'react-icons/fa6';

type User = {
  id: string;
  name: string;
  picture: string | null;
  email: string;
  role: string;
};

export default function AccountManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/user');
      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }
      const data: User[] = await res.json();
      setUsers(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="pt-15 pb-12 px-4 sm:px-6 lg:px-10 max-w-[1400px] mx-auto w-full min-h-screen flex">
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 lg:p-10 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 lg:gap-8 mb-8 lg:mb-10">

            <div className="space-y-1 min-w-0">
              <h1 className="text-2xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-blueit leading-tight lg:whitespace-nowrap">
                จัดการบัญชีและสิทธิ์การเข้าถึง
              </h1>
              <p className="text-sm sm:text-sm md:text-base lg:text-lg font-semibold text-gray-900 leading-snug lg:whitespace-nowrap">
                Account and Permission Management
              </p>
            </div>
            <div className="w-full flex justify-end">
              <Link href="/management/userAccount/signup">
                <button className="flex items-center justify-center gap-x-1.5 sm:gap-x-2 lg:gap-x-3 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition px-2.5 py-2 sm:px-4 sm:py-2 lg:px-6 lg:py-3 shadow-md">
                  <FaCirclePlus className="text-base sm:text-xl lg:text-2xl" />
                  <span className="font-semibold text-sm sm:text-sm lg:text-base">เพิ่มบัญชีใหม่</span>
                </button>
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 text-lg">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {users.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-500 text-lg">ยังไม่มีข้อมูลผู้ใช้</p>
                </div>
              ) : (
                users.map((user) => (
                  <Link
                    key={user.id}
                    href={`/management/userAccount/editAccount?id=${user.id}`}
                    className="w-full bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 flex flex-col cursor-pointer"
                  >
                    <div className="bg-gray-100 h-40 sm:h-56 w-full flex items-center justify-center text-gray-400 overflow-hidden">
                      {user.picture ? (
                        <img
                          src={user.picture.startsWith("/") ? user.picture : `/${user.picture}`}
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs sm:text-base">รูปภาพเจ้าหน้าที่</span>
                      )}
                    </div>

                    <div className="bg-[#d9d9d9] p-3 sm:p-4 space-y-1.5 sm:space-y-2">
                      <p className="font-medium text-black text-sm mx-2 sm:mx-4 sm:text-base truncate">
                        {user.name}
                      </p>
                      <div className="flex items-center text-black text-xs sm:text-sm mx-2 sm:mx-4 truncate">
                        <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 flex-shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}