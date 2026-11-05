import manifest from "../data/character_manifest.json";

const ACCENTS: Record<string, string> = {
  corgi_scout: "#f4a62a",
  cat_coder: "#9aa4bd",
  penguin_pilot: "#e84747",
  bunny_creator: "#f7c84a",
  panda_dj: "#f1bd30",
  bear_guard: "#9b5b2e",
  red_panda_analyst: "#43d9f2",
  rooster_speedster: "#ff553f",
};

export type CharacterVisualState = "idle" | "locomotion" | "jump" | "fall" | "land" | "dash" | "hit" | "respawn";

export type CharacterDefinition = {
  id: string;
  displayName: string;
  role: string;
  image: string;
  baseSpeed: number;
  jumpImpulse: number;
  mass: number;
  accent: string;
};

export const CHARACTERS: CharacterDefinition[] = manifest.characters.map((character) => ({
  ...character,
  image: `/characters/${character.referenceImage.split("/").pop()}`,
  accent: ACCENTS[character.id] ?? "#8b5cf6",
}));

export const DEFAULT_CHARACTER_ID = CHARACTERS[0].id;
const CHARACTER_BY_ID = new Map(CHARACTERS.map((character) => [character.id, character]));

export function isCharacterId(value: unknown): value is string {
  return typeof value === "string" && CHARACTER_BY_ID.has(value);
}

export function getCharacter(id?: string | null) {
  return CHARACTER_BY_ID.get(id ?? "") ?? CHARACTERS[0];
}

export function getCharacterPhysics(id?: string | null) {
  const character = getCharacter(id);
  return {
    speedMultiplier: character.baseSpeed / 5,
    jumpMultiplier: character.jumpImpulse / 6.5,
    mass: character.mass,
  };
}
