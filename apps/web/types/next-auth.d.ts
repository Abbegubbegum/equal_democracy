/* eslint-disable no-unused-vars */
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isAdmin: boolean;
      isSuperAdmin: boolean;
      adminStatus?: string;
      municipality?: string;
    };
  }

  interface User {
    id: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    adminStatus?: string;
    municipality?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    adminStatus?: string;
    municipality?: string;
    lastRefreshed?: number;
  }
}
