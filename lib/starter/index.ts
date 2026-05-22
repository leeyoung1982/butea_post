/**
 * Starter docs — the 3 example articles seeded on first run.
 *
 * Each entry is one file under this directory. Order in the array determines
 * the order they appear in the document library; DocSync bootstrap creates
 * them with staggered timestamps so the first item lands at the top.
 */

import * as doc01 from "./01-readme";
import * as doc02 from "./02-features";
import * as doc03 from "./03-markdown";

export type StarterDoc = {
  title: string;
  markdown: string;
};

export const STARTER_DOCS: StarterDoc[] = [
  { title: doc01.TITLE, markdown: doc01.MARKDOWN },
  { title: doc02.TITLE, markdown: doc02.MARKDOWN },
  { title: doc03.TITLE, markdown: doc03.MARKDOWN },
];
