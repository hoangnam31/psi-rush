import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

function isSiteEnabled(value: string | undefined) {
  return !["0", "false", "off", "disabled"].includes((value ?? "true").trim().toLowerCase());
}

function maintenanceResponse(request: Request) {
  const url = new URL(request.url);
  const headers = new Headers({
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Retry-After": "300",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Referrer-Policy": "no-referrer",
  });

  if (url.pathname.startsWith("/api/")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(request.method === "HEAD" ? null : JSON.stringify({
      error: "PSI RUSH đang tạm đóng bởi nhà phát triển.",
      code: "SITE_DISABLED",
    }), { status: 503, headers });
  }

  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  if (!acceptsHtml) {
    headers.set("Content-Type", "text/plain; charset=utf-8");
    return new Response(request.method === "HEAD" ? null : "PSI RUSH is temporarily offline.", { status: 503, headers });
  }

  headers.set("Content-Type", "text/html; charset=utf-8");
  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta name="robots" content="noindex,nofollow"><title>PSI RUSH — Tạm đóng</title>
<style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,sans-serif;background:#12072d;color:#fff}body{min-height:100dvh;display:grid;place-items:center;overflow:hidden}.bg{position:fixed;inset:-25%;background:radial-gradient(circle at 50% 45%,#7838e0 0,#33107b 38%,#12072d 72%);transform:rotate(-8deg)}main{position:relative;width:min(560px,calc(100vw - 36px));padding:48px 32px;text-align:center;border:1px solid #ffffff26;border-radius:28px;background:#17083dcc;box-shadow:0 30px 90px #06001499}.badge{display:inline-flex;align-items:center;gap:9px;padding:9px 14px;border-radius:99px;background:#ff3d9a22;color:#ff91c4;font-size:11px;font-weight:900;letter-spacing:.12em}.badge i{width:9px;height:9px;border-radius:50%;background:#ff3d9a;box-shadow:0 0 0 5px #ff3d9a20}h1{margin:24px 0 15px;font-size:clamp(46px,12vw,82px);line-height:.88;font-weight:1000;font-style:italic;letter-spacing:-.07em;text-shadow:0 7px 0 #2e0c73}h1 em{display:block;color:#ffe14a;font-style:normal;-webkit-text-stroke:2px #fff;paint-order:stroke fill}p{margin:0 auto;max-width:410px;color:#ffffffa8;font-size:14px;line-height:1.7;font-weight:700}.credit{margin-top:32px;color:#ffffff58;font-size:9px;font-weight:900;letter-spacing:.15em}</style></head>
<body><div class="bg"></div><main><span class="badge"><i></i> DEVELOPER MODE</span><h1>PSI RUSH<em>TẠM ĐÓNG</em></h1><p>Nhà phát triển đang tạm dừng hệ thống. Vui lòng quay lại khi trò chơi được mở lại.</p><div class="credit">SẢN PHẨM CỦA NAMVH7</div></main></body></html>`;
  return new Response(request.method === "HEAD" ? null : html, { status: 503, headers });
}

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    if (!isSiteEnabled(env.PSI_RUSH_SITE_ENABLED)) return maintenanceResponse(request);

    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
