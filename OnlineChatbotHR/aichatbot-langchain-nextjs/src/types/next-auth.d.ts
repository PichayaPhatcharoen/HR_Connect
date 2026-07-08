import "next-auth";
import "next-auth/jwt";

// ขยาย Type ของ JWT
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    email: string;
    role: string;
  }
}

// ขยาย Type ของ Session
declare module "next-auth" {
  /**
   * คืนค่าโดย `useSession`, `getSession` และ `getServerSession`
   */
  interface Session {
    user: {
      id: string;
      username: string;
      email: string;
      role: string;
    };
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * available here as `user`.
   */
  interface User {
    id: string;
    username: string;
    email: string;
    role: string;
  }
}