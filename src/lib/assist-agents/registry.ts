import spiceA from './recipes/spice-a.json';
import spiceB from './recipes/spice-b.json';
import agilePro from './recipes/agile-pro-s.json';
import emoa from './recipes/emoa.json';
import eaoa from './recipes/eaoa.json';
import mcaV3 from './packs/mca-v3.json';
import incomeTax from './packs/income-tax-efiling.json';
import traces from './packs/traces.json';
import protean from './packs/protean-tin.json';
import gst from './packs/gst.json';
import epfo from './packs/epfo.json';
import esic from './packs/esic.json';
import udyam from './packs/udyam.json';
import dgft from './packs/dgft.json';
import { parseRecipe, resolveRecipe, type Recipe } from './recipe';
import { parsePack, type PortalPack } from './pack';

/**
 * The recipe and pack registry: every recipe and portal pack file, parsed once against its schema.
 * A recipe is code, so a change ships with a deploy and its version must be bumped (an approved
 * patch is applied by a person editing the JSON and bumping the version; the patch row records what
 * to change). `getRecipe` returns the recipe with its pack applied (`resolveRecipe`): that is what
 * Suite signs and serves, and what the extension's bundle holds.
 */
const RECIPE_FILES: readonly unknown[] = [spiceA, spiceB, agilePro, emoa, eaoa];
const PACK_FILES: readonly unknown[] = [mcaV3, incomeTax, traces, protean, gst, epfo, esic, udyam, dgft];

let packCache: Map<string, PortalPack> | null = null;
let cache: Map<string, Recipe> | null = null;

function packs(): Map<string, PortalPack> {
  if (!packCache) packCache = new Map(PACK_FILES.map((raw) => parsePack(raw)).map((p) => [p.id, p]));
  return packCache;
}

function recipes(): Map<string, Recipe> {
  if (!cache) cache = new Map(RECIPE_FILES.map((raw) => resolveRecipe(parseRecipe(raw), packs())).map((r) => [r.id, r]));
  return cache;
}

export function getRecipe(id: string): Recipe | null {
  return recipes().get(id) ?? null;
}

export function listRecipes(): Recipe[] {
  return [...recipes().values()];
}

/** The recipe as its file holds it, before the pack is applied (for tests and tooling). */
export function rawRecipeFiles(): Recipe[] {
  return RECIPE_FILES.map((raw) => parseRecipe(raw));
}

export function getPack(id: string): PortalPack | null {
  return packs().get(id) ?? null;
}

export function listPacks(): PortalPack[] {
  return [...packs().values()];
}
