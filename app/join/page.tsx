"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bean } from "../../components/Bean";
import { WobbleLogo } from "../../components/WobbleLogo";
import { CHARACTERS, DEFAULT_CHARACTER_ID, getCharacter } from "../../lib/characters";
import { roomAction } from "../../lib/types";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [characterId, setCharacterId] = useState(DEFAULT_CHARACTER_ID);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = getCharacter(characterId);

  useEffect(() => { setCode(new URLSearchParams(location.search).get("room")?.toUpperCase() || ""); }, []);
  async function join() {
    setBusy(true); setError("");
    try {
      const data = await roomAction(code, { action: "join", name, characterId });
      localStorage.setItem(`wobble_player_${code}`, JSON.stringify(data));
      router.push(`/play?room=${code}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tham gia");
    } finally { setBusy(false); }
  }

  return <main className="join-shell"><header className="app-nav"><WobbleLogo compact/><span className="view-tag player">PLAYER JOIN</span></header><section className="join-card">
    <div className="join-character"><div className="spotlight"/><Bean characterId={characterId} size="lg" name={name || "Tay đua"}/><div className="character-meta"><b>{selected.displayName}</b><small>{selected.role}</small></div><span>CHỌN NHÂN VẬT</span><div className="character-grid">{CHARACTERS.map((character) => <button key={character.id} type="button" aria-label={`Chọn ${character.displayName}`} aria-pressed={character.id === characterId} className={character.id === characterId ? "selected" : ""} onClick={() => setCharacterId(character.id)}><Bean characterId={character.id} size="sm"/><b>{character.displayName}</b><small>{character.role}</small></button>)}</div></div>
    <div className="join-form"><span className="eyebrow">SẴN SÀNG CHƯA?</span><h1>VÀO<br/><em>ĐƯỜNG ĐUA!</em></h1><label>MÃ PHÒNG<input value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="ABC123"/></label><label>TÊN HIỂN THỊ<input value={name} onChange={event => setName(event.target.value.slice(0, 16))} placeholder="Nhập tên của bạn"/></label>{error && <p className="form-error">{error}</p>}<button className="primary-action" disabled={busy || code.length < 6 || !name.trim()} onClick={join}>{busy ? "ĐANG VÀO PHÒNG..." : "THAM GIA NGAY →"}</button><p className="join-note">Tên và nhân vật của bạn sẽ hiển thị trong suốt cuộc chơi.</p></div>
  </section></main>;
}
