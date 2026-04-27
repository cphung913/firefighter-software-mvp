export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/checklists/:path*",
    "/incidents/:path*",
    "/assets/:path*",
    "/settings/:path*",
  ],
};
