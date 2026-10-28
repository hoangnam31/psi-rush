"use client";

import { useEffect, useRef, useState } from "react";
import { GameAudio } from "../lib/game-audio";

export function LobbyMusic() {
  const audioRef = useRef<GameAudio | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = new GameAudio("lobby");
    audioRef.current = audio;
    const unlock = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(".lobby-sound-toggle")) return;
      void audio.unlock().then(setPlaying);
    };
    void audio.unlock().then(setPlaying);
    addEventListener("pointerdown", unlock);
    addEventListener("keydown", unlock);
    return () => {
      removeEventListener("pointerdown", unlock);
      removeEventListener("keydown", unlock);
      audio.stop();
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, []);

  async function toggleSound() {
    if (!soundOn || !playing) {
      setSoundOn(true);
      audioRef.current?.setEnabled(true);
      setPlaying(await audioRef.current?.unlock() === true);
      return;
    }
    setSoundOn(false);
    setPlaying(false);
    audioRef.current?.setEnabled(false);
  }

  const active = soundOn && playing;
  return <button className={`sound-toggle lobby-sound-toggle ${active ? "playing" : "muted"}`} onClick={() => void toggleSound()} aria-label={active ? "Tắt nhạc phòng chờ" : "Bật nhạc phòng chờ"}>
    <b>{active ? "♪" : "▶"}</b><span>{active ? "ĐANG PHÁT" : soundOn ? "CHẠM BẬT NHẠC" : "ĐÃ TẮT"}</span>
  </button>;
}
