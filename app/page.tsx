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
        <span className="eyebrow">PSI MASCOT LEAGUE · 200 TAY ĐUA · 5 MAP</span>
        <h1>BIỆT ĐỘI<br/><em>BỨT PHÁ!</em></h1>
        <p>Chọn mascot PSI của bạn, lập đội hình nội bộ và cùng chinh phục chuỗi thử thách vui nhộn. Một màn hình cho host, một nhân vật riêng cho mỗi tay đua.</p>
        <div className="entry-actions">
          <button className="mega-btn host" onClick={createNewRoom}><span>＋</span><b>TẠO PHÒNG</b><small>Luôn tạo session mới</small></button>
          <div className="join-box"><label>THAM GIA BẰNG MÃ</label><div><input value={code} onChange={(e)=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6))} placeholder="ABC123"/><button onClick={()=>router.push(`/join?room=${code}`)} disabled={code.length<6}>JOIN →</button></div></div>
        </div>
        <div className="feature-strip"><span><b>01</b> CHỌN MASCOT</span><span><b>02</b> VƯỢT THỬ THÁCH</span><span><b>03</b> VINH DANH BIỆT ĐỘI</span></div>
      </div>
      <div className="landing-art" aria-hidden="true">
        <div className="hero-ring r1"/><div className="hero-ring r2"/><div className="hero-burst">GO!</div>
        <div className="hero-squad hero-squad-left"><Bean characterId="cat_coder" size="lg"/></div>
        <div className="hero-squad hero-squad-right"><Bean characterId="penguin_pilot" size="lg"/></div>
        <div className="hero-squad hero-squad-lead"><Bean characterId="corgi_scout" size="lg" crown/></div>
      </div>
    </section>
    <footer className="landing-footer"><span>PSI RUSH</span><span>Built for teams that play hard.</span></footer>
  </main>;
}
