"use client";

import { useEffect, useRef, useState } from "react";
import { GameAudio } from "../lib/game-audio";

export function LobbyMusic() {
  const audioRef = useRef<GameAudio | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    const audio = new GameAudio("lobby");
    audioRef.current = audio;
    const unlock = () => audio.unlock();
    audio.unlock();
    addEventListener("pointerdown", unlock);
    addEventListener("keydown", unlock);
    return () => {
      removeEventListener("pointerdown", unlock);
      removeEventListener("keydown", unlock);
      audio.stop();
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    audioRef.current?.setEnabled(next);
  }

  return <button className={`sound-toggle lobby-sound-toggle ${soundOn ? "" : "muted"}`} onClick={toggleSound} aria-label={soundOn ? "Tắt nhạc phòng chờ" : "Bật nhạc phòng chờ"}>
    <b>{soundOn ? "♪" : "×"}</b><span>{soundOn ? "NHẠC PHÒNG CHỜ" : "ĐÃ TẮT"}</span>
  </button>;
}
