import Image from "next/image";
import { DEFAULT_CHARACTER_ID, getCharacter, type CharacterVisualState } from "../lib/characters";

type Props = { characterId?: string; name?: string; size?: "sm" | "md" | "lg"; crown?: boolean; state?: CharacterVisualState };

export function Bean({ characterId = DEFAULT_CHARACTER_ID, name, size = "md", crown = false, state = "idle" }: Props) {
  const character = getCharacter(characterId);
  return <div className={`bean-wrap bean-${size} mascot-${state}${crown ? " has-crown" : ""}`} title={`${character.displayName} · ${character.role}`}>
    {crown && <span className="bean-crown">♛</span>}
    {name && <span className="bean-name">{name}</span>}
    <div className="mascot-art" style={{ "--mascot-accent": character.accent } as React.CSSProperties}>
      <Image src={character.image} alt={character.displayName} width={384} height={512} draggable={false} priority={size === "lg"}/>
    </div>
  </div>;
}
