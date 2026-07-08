import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const auth = async () => {
    return await getServerSession(authOptions);
}