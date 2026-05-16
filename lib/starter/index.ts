/**
 * Starter docs — the 8 example articles seeded on first run.
 *
 * Each entry is one file under this directory. Order in the array determines
 * the order they appear in the document library; DocSync bootstrap creates
 * them with staggered timestamps so the first item lands at the top.
 */

import * as doc01 from "./01-overview";
import * as doc02 from "./02-day-with-butea";
import * as doc03 from "./03-inspiration";
import * as doc04 from "./04-writing";
import * as doc05 from "./05-images";
import * as doc06 from "./06-platforms";
import * as doc07 from "./07-doc-asset-management";
import * as doc08 from "./08-settings";

export type StarterDoc = {
  title: string;
  markdown: string;
};

export const STARTER_DOCS: StarterDoc[] = [
  { title: doc01.TITLE, markdown: doc01.MARKDOWN },
  { title: doc02.TITLE, markdown: doc02.MARKDOWN },
  { title: doc03.TITLE, markdown: doc03.MARKDOWN },
  { title: doc04.TITLE, markdown: doc04.MARKDOWN },
  { title: doc05.TITLE, markdown: doc05.MARKDOWN },
  { title: doc06.TITLE, markdown: doc06.MARKDOWN },
  { title: doc07.TITLE, markdown: doc07.MARKDOWN },
  { title: doc08.TITLE, markdown: doc08.MARKDOWN },
];
