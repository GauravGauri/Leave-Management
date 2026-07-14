import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      role?: string;
      department?: any;
      designation?: any;
      manager?: any;
      gender?: string;
      avatar?: string;
      accessToken?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    role?: string;
    department?: any;
    designation?: any;
    manager?: any;
    gender?: string;
    avatar?: string;
    token?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    department?: any;
    designation?: any;
    manager?: any;
    gender?: string;
    avatar?: string;
    accessToken?: string;
  }
}
