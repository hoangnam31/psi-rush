import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "data/character_manifest.json"), "utf8"));
const characters = manifest.characters ?? [];
if (characters.length !== 8) throw new Error(`Expected 8 characters, found ${characters.length}`);
const ids = new Set();
for (const character of characters) {
  if (!character.id || ids.has(character.id)) throw new Error(`Invalid or duplicate id: ${character.id}`);
  ids.add(character.id);
  if (!(character.baseSpeed > 0 && character.jumpImpulse > 0 && character.mass > 0)) throw new Error(`Invalid physics values for ${character.id}`);
  const filename = character.referenceImage.split("/").pop();
  await access(path.join(root, "public/characters", filename));
  await access(path.join(root, "public/characters", `${character.id}_cutout.png`));
}
console.log(`Validated ${characters.length} PSI Rush characters, concept references and transparent gameplay cutouts.`);
