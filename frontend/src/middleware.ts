export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/leaves/:path*',
    '/calendar/:path*',
    '/admin/:path*',
    '/reports/:path*',
  ],
};
