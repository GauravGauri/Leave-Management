import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'employee@company.com' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const res = await axios.post(`${API_URL}/auth/login`, {
            email: credentials.email,
            password: credentials.password
          });

          const user = res.data;

          if (user && user.token) {
            // Return user object containing token and profile details
            return {
              id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
              department: user.department,
              designation: user.designation,
              manager: user.manager,
              gender: user.gender,
              avatar: user.avatar,
              token: user.token
            };
          }
          return null;
        } catch (error: any) {
          console.error('NextAuth authorize error:', error.response?.data || error.message);
          if (error.response) {
            throw new Error(error.response.data?.message || 'Invalid email or password');
          } else {
            throw new Error(`API Unreachable: Cannot connect to backend at ${API_URL}. Details: ${error.message}`);
          }
        }
    })
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.department = user.department;
        token.designation = user.designation;
        token.manager = user.manager;
        token.gender = user.gender;
        token.avatar = user.avatar;
        token.accessToken = user.token;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.department = token.department;
        session.user.designation = token.designation;
        session.user.manager = token.manager;
        session.user.gender = token.gender;
        session.user.avatar = token.avatar;
        session.user.accessToken = token.accessToken;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || 'nextauth_secret_dev_123_hrms',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
