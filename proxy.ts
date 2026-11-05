import { NextRequest, NextResponse } from "next/server";

function isSiteEnabled(value: string | undefined) {
  return !["0", "false", "off", "disabled"].includes((value ?? "true").trim().toLowerCase());
}

const maintenanceHtml = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta name="robots" content="noindex,nofollow"><title>PSI RUSH — Tạm đóng</title>
<style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,sans-serif;background:#12072d;color:#fff}body{min-height:100dvh;display:grid;place-items:center;overflow:hidden}.bg{position:fixed;inset:-25%;background:radial-gradient(circle at 50% 45%,#7838e0 0,#33107b 38%,#12072d 72%);transform:rotate(-8deg)}main{position:relative;width:min(560px,calc(100vw - 36px));padding:48px 32px;text-align:center;border:1px solid #ffffff26;border-radius:28px;background:#17083dcc;box-shadow:0 30px 90px #06001499}.badge{display:inline-flex;align-items:center;gap:9px;padding:9px 14px;border-radius:99px;background:#ff3d9a22;color:#ff91c4;font-size:11px;font-weight:900;letter-spacing:.12em}.badge i{width:9px;height:9px;border-radius:50%;background:#ff3d9a;box-shadow:0 0 0 5px #ff3d9a20}h1{margin:24px 0 15px;font-size:clamp(46px,12vw,82px);line-height:.88;font-weight:1000;font-style:italic;letter-spacing:-.07em;text-shadow:0 7px 0 #2e0c73}h1 em{display:block;color:#ffe14a;font-style:normal;-webkit-text-stroke:2px #fff;paint-order:stroke fill}p{margin:0 auto;max-width:410px;color:#ffffffa8;font-size:14px;line-height:1.7;font-weight:700}</style></head>
<body><div class="bg"></div><main><span class="badge"><i></i> DEVELOPER MODE</span><h1>PSI RUSH<em>TẠM ĐÓNG</em></h1><p>Nhà phát triển đang tạm dừng hệ thống. Vui lòng quay lại khi trò chơi được mở lại.</p></main></body></html>`;

export function proxy(request: NextRequest) {
  if (isSiteEnabled(process.env.PSI_RUSH_SITE_ENABLED)) return NextResponse.next();

  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Retry-After": "300",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Referrer-Policy": "no-referrer",
  };

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "PSI RUSH đang tạm đóng bởi nhà phát triển.", code: "SITE_DISABLED" },
      { status: 503, headers },
    );
  }

  return new NextResponse(maintenanceHtml, {
    status: 503,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"],
};
