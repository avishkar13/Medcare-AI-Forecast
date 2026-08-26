import type { NextConfig } from "next";

// The deployed backend is http-only, so an https page cannot call it directly.
// Proxying keeps the request same-origin: the browser talks https to vercel, and
// vercel talks http to the backend server-side, where mixed content does not apply.
// Unset in local dev, where NEXT_PUBLIC_API_URL points straight at the backend.
const backendOrigin = process.env.BACKEND_ORIGIN?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backendOrigin) return [];

    return [{ source: "/api/:path*", destination: `${backendOrigin}/api/:path*` }];
  },
};

export default nextConfig;
