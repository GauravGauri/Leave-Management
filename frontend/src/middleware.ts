import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    
    // Fail-safe bypass for authentication routes or login page
    if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
      return NextResponse.next();
    }
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/leaves/:path*',
    '/calendar/:path*',
    '/admin/:path*',
    '/reports/:path*',
  ],
};
