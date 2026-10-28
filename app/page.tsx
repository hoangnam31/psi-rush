"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bean } from "../components/Bean";
import { WobbleLogo } from "../components/WobbleLogo";

export default function Home() {
  const router = useRouter(); const [code, setCode] = useState("");
  function createNewRoom() {
    localStorage.removeItem("wobble_host");
    router.push("/host?new=1");
  }
  return <main className="landing-shell">
    <header className="landing-nav"><WobbleLogo/><span className="internal-pill"><i/> INTERNAL PARTY GAME</span></header>
    <section className="landing-grid">
      <div className="landing-copy">
        <span className="eyebrow">200 NGƯỜI · NHIỀU ROUND · 5 MAP</span>
        <h1>VĂN PHÒNG<br/><em>ĐẠI HỖN CHIẾN!</em></h1>
        <p>Tạo giải đấu nội bộ, mời mọi người quét mã và cùng lao vào những đường đua hỗn loạn. Một màn hình cho host. Một tay đua cho mỗi người.</p>
        <div className="entry-actions">
          <button className="mega-btn host" onClick={createNewRoom}><span>＋</span><b>TẠO PHÒNG</b><small>Luôn tạo session mới</small></button>
          <div className="join-box"><label>THAM GIA BẰNG MÃ</label><div><input value={code} onChange={(e)=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6))} placeholder="ABC123"/><button onClick={()=>router.push(`/join?room=${code}`)} disabled={code.length<6}>JOIN →</button></div></div>
        </div>
        <div className="feature-strip"><span><b>01</b> QUÉT MÃ ĐỂ JOIN</span><span><b>02</b> ĐUA NHIỀU ROUND</span><span><b>03</b> TÍNH ĐIỂM TỔNG</span></div>
      </div>
      <div className="landing-art" aria-hidden="true">
        <div className="hero-ring r1"/><div className="hero-ring r2"/><div className="hero-burst">GO!</div>
        <Bean color="#8b5cf6" size="lg" crown/><div className="side-bean pink"><Bean color="#ff3d9a"/></div><div className="side-bean lime"><Bean color="#b6f43b"/></div>
      </div>
    </section>
    <footer className="landing-footer"><span>PSI RUSH</span><span>Built for teams that play hard.</span></footer>
  </main>;
}
