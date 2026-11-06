"use client";

import Image from "next/image";

export function LoadingCorgi({ paused = false }: { paused?: boolean }) {
  return <div className={`loading-corgi ${paused ? "paused" : ""}`} aria-hidden="true">
    <i className="corgi-speed corgi-speed-one"/>
    <i className="corgi-speed corgi-speed-two"/>
    <span className="corgi-smoke smoke-one"/>
    <span className="corgi-smoke smoke-two"/>
    <span className="corgi-smoke smoke-three"/>
    <Image className="loading-corgi-runner" src="/characters/corgi_scout_cutout.png" alt="" width={384} height={512} priority/>
    <b className="corgi-ground"/>
  </div>;
}
