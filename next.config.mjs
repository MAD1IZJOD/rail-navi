/** @type {import('next').NextConfig} */
const config={
 async headers(){
  return[
   {source:"/:path*",headers:[{key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},{key:"Permissions-Policy",value:"camera=(self), microphone=(), geolocation=()"}]},
   {source:"/sw.js",headers:[{key:"Content-Type",value:"application/javascript; charset=utf-8"},{key:"Cache-Control",value:"no-cache, no-store, must-revalidate"},{key:"Service-Worker-Allowed",value:"/"},{key:"Content-Security-Policy",value:"default-src 'self'; script-src 'self'; connect-src 'self'"}]},
   {source:"/offline-manifest.json",headers:[{key:"Cache-Control",value:"no-cache, no-store, must-revalidate"}]},
  ];
 },
};
export default config;
