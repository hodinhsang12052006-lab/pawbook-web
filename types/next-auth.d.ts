import { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

// The app's session/jwt callbacks (lib/authOptions.ts) always attach `id`
// and `role` to session.user and the token — these augmentations make that
// contract visible to the type checker instead of every call site casting
// `session.user as any` to reach `.id`.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
