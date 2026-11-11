/**
 * The offline harness's in-page entry (`tools/offline/run-offline.mjs` bundles it with esbuild and
 * injects it into a captured page in Chromium). It exposes one function and calls nothing outside
 * the page.
 */
import { normalizeRecipe } from '../recipes/normalize';
import { offlineFill, pagesForPath } from './offline-fill';

(window as unknown as { __vcfoOffline: unknown }).__vcfoOffline = {
  async run(rawRecipe: unknown, profile: Record<string, unknown>) {
    const recipe = normalizeRecipe(rawRecipe);
    const pages = pagesForPath(recipe, location.pathname);
    if (!pages.length) return null;
    return offlineFill(document, recipe, profile, pages);
  },
};
