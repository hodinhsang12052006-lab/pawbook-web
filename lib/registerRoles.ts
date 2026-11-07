// Sign-up roles of /auth/register?role=… — shared by the edge rewrite (next.config.ts), the prerendered role pages
// (app/[lang]/auth/register/[role]) and the client flow (components/auth/RegisterFlow.tsx).
export const REGISTER_ROLES = ["client", "technician", "owner"] as const;
export type RegisterRole = (typeof REGISTER_ROLES)[number];
export const isRegisterRole = (v: unknown): v is RegisterRole => (REGISTER_ROLES as readonly unknown[]).includes(v);
