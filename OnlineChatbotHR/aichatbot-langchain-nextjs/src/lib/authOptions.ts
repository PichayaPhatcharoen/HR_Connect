import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";


export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials) {
                    throw new Error("No credentials provided");
                }
                const { username, password } = credentials;
                const user = await prisma.users.findUnique({
                    where: { Username: username },
                });
                //ถ้าไม่มีแอคเคาท์ในระบบ
                if (!user) {
                    throw new Error("User not found");
                }
                //เช็ครหัสผ่าน
                const passwordsMatch = await bcrypt.compare(password, user.Password);
                if (!passwordsMatch) {
                    throw new Error("Invalid password");
                }
                //เข้าสู่ระบบสำเร็จ
                if (user) return {
                    id: user.UserId,
                    username: user.Username,
                    email: user.Email,
                    role: user.Role,
                };
                //อาจมีกรณีนอกเหนือจากนี้
                return null;
            }
        })
    ],
    debug: true,
    session: {
        strategy: "jwt"
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.username = user.username;
                token.email = user.email;
                token.role = user.role;
            }
            return token;
        },
        async session({ session, token }) {
            if (token.sub) {
                session.user.id = token.id;
                session.user.username = token.username;
                session.user.email = token.email;
                session.user.role = token.role;
            }
            return session;
        }
    }
}