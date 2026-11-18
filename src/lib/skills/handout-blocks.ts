// Turns a week's handout text into a few plain blocks a page can draw. A PURE function: no database, no React.
// (No "@/" imports on purpose: the tests in this folder load this file directly with Node.)
//
// The handout is free text with, at most, "#" headings, "-" or "*" bullets and **bold**. Nothing here ever produces
// HTML: the page draws each piece as ordinary text, so a handout can never inject markup or a link of its own.

export type Inline = { text: string; bold: boolean };
export type HandoutBlock =
  | { kind: "heading"; parts: Inline[] }
  | { kind: "paragraph"; parts: Inline[] }
  | { kind: "list"; items: Inline[][] };

/** Splits one line of text into plain and **bold** pieces. An unmatched ** stays as plain text. */
export function inlineParts(line: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+?)\*\*/g;
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), bold: false });
    out.push({ text: m[1]!, bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), bold: false });
  return out.length ? out : [{ text: "", bold: false }];
}

const HEADING = /^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const BULLET = /^[ \t]*(?:[-*•])[ \t]+(.+)$/;
const NUMBERED = /^[ \t]*\d{1,2}[.)][ \t]+(.+)$/;

/** Handout text -> blocks. Blank lines end a paragraph; consecutive bullet or numbered lines form one list. */
export function parseHandout(text: string): HandoutBlock[] {
  const blocks: HandoutBlock[] = [];
  let para: string[] = [];
  let list: Inline[][] | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "paragraph", parts: inlineParts(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list && list.length) blocks.push({ kind: "list", items: list });
    list = null;
  };
  for (const raw of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushPara();
      flushList();
      continue;
    }
    const heading = HEADING.exec(line.trim());
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ kind: "heading", parts: inlineParts(heading[1]!) });
      continue;
    }
    const item = BULLET.exec(line) ?? NUMBERED.exec(line);
    if (item) {
      flushPara();
      (list ??= []).push(inlineParts(item[1]!.trim()));
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}
