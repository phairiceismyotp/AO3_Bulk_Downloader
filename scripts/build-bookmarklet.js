#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_SOURCE = "AO3BulkDownloader.readable.js";
const DEFAULT_OUTPUT = path.join("dist", "AO3BulkDownloader.bookmarklet.txt");
const JS_PREFIX = "javascript:";

const RE = {
  bom: /^\uFEFF/,
  leadingBlockComment: /^\s*\/\*[\s\S]*?\*\/\s*/,
  lineBreak: /\r\n?|\n/,
  urlExtra: /[!'()*]/g,
  whitespace: /\s/,
  word: /[$\w]/,
};

const REGEX_PREFIX_CHARS = "([{=,:;!&|?+-*~^<>";

try {
  build();
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
}

function build() {
  const sourceFile = resolveArg(2, DEFAULT_SOURCE);
  const rawFile = resolveArg(3, DEFAULT_OUTPUT);
  const encodedFile = getEncodedFile(rawFile);
  const source = readSource(sourceFile);
  const runtime = stripHeader(source);
  const minified = minifyJs(runtime);
  const raw = `${JS_PREFIX}${minified}`;
  const encoded = `${JS_PREFIX}${encodeRuntime(minified)}`;

  assertJs(minified, "minified bookmarklet runtime");
  writeFile(rawFile, raw);
  writeFile(encodedFile, encoded);
  printSummary({ sourceFile, rawFile, encodedFile, source, minified, raw, encoded });
}

function resolveArg(index, fallback) {
  return path.resolve(process.cwd(), process.argv[index] || fallback);
}

function readSource(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`source file not found: ${file}`);
  }

  const source = fs.readFileSync(file, "utf8").replace(RE.bom, "").trim();
  assertJs(source, file);
  return source;
}

function assertJs(source, label) {
  try {
    new Function(source);
  } catch (error) {
    throw new Error(`${label} has invalid JavaScript: ${error.message}`);
  }
}

function stripHeader(source) {
  return source.replace(RE.leadingBlockComment, "").trim();
}

function minifyJs(source) {
  let output = "";

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (RE.whitespace.test(char)) {
      const right = nextToken(source, index + 1);
      if (needsSpace(output.at(-1), right)) {
        output += " ";
      }
      continue;
    }

    if (isLineComment(char, next)) {
      index = skipLineComment(source, index + 2);
      continue;
    }

    if (isBlockComment(char, next)) {
      index = skipBlockComment(source, index + 2);
      continue;
    }

    if (char === "/" && startsRegex(output)) {
      const end = findRegexEnd(source, index);
      output += source.slice(index, end + 1);
      index = end;
      continue;
    }

    if (isQuote(char)) {
      const end = findStringEnd(source, index, char);
      output += source.slice(index, end + 1);
      index = end;
      continue;
    }

    if (char === "`") {
      const template = minifyTemplate(source, index);
      output += template.code;
      index = template.end;
      continue;
    }

    output += char;
  }

  return output.trim();
}

function minifyTemplate(source, start) {
  let output = "`";
  let text = "";
  let firstText = true;

  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "\\") {
      text += char + (next || "");
      index += 1;
      continue;
    }

    if (char === "`") {
      output += minifyTemplateText(text, { trimStart: firstText, trimEnd: true });
      return { code: `${output}\``, end: index };
    }

    if (char === "$" && next === "{") {
      const end = findTemplateExprEnd(source, index + 2);
      output += minifyTemplateText(text, { trimStart: firstText });
      output += "${" + minifyJs(source.slice(index + 2, end)) + "}";
      text = "";
      firstText = false;
      index = end;
      continue;
    }

    text += char;
  }

  throw new Error("unterminated template literal");
}

function minifyTemplateText(text, options = {}) {
  let output = text
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/\s*([{}:;,])\s*/g, "$1");

  if (options.trimStart) {
    output = output.trimStart();
  }

  if (options.trimEnd) {
    output = output.trimEnd();
  }

  return output;
}

function findStringEnd(source, start, quote) {
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];

    if (char === "\\") {
      index += 1;
      continue;
    }

    if (char === quote) {
      return index;
    }
  }

  throw new Error(`unterminated ${quote} string`);
}

function findTemplateExprEnd(source, start) {
  let depth = 1;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (isQuote(char)) {
      index = findStringEnd(source, index, char);
      continue;
    }

    if (char === "`") {
      index = skipTemplate(source, index);
      continue;
    }

    if (isLineComment(char, next)) {
      index = skipLineComment(source, index + 2);
      continue;
    }

    if (isBlockComment(char, next)) {
      index = skipBlockComment(source, index + 2);
      continue;
    }

    if (char === "/" && startsRegex(source.slice(0, index).trimEnd())) {
      index = findRegexEnd(source, index);
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error("unterminated template expression");
}

function skipTemplate(source, start) {
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "\\") {
      index += 1;
      continue;
    }

    if (char === "`") {
      return index;
    }

    if (char === "$" && next === "{") {
      index = findTemplateExprEnd(source, index + 2);
    }
  }

  throw new Error("unterminated nested template literal");
}

function nextToken(source, start) {
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (RE.whitespace.test(char)) {
      continue;
    }

    if (isLineComment(char, next)) {
      index = skipLineComment(source, index + 2);
      continue;
    }

    if (isBlockComment(char, next)) {
      index = skipBlockComment(source, index + 2);
      continue;
    }

    return char;
  }

  return "";
}

function needsSpace(left, right) {
  return Boolean(left && right && RE.word.test(left) && RE.word.test(right));
}

function startsRegex(output) {
  const previous = output.trimEnd().at(-1);
  return !previous || REGEX_PREFIX_CHARS.includes(previous);
}

function findRegexEnd(source, start) {
  let inClass = false;

  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];

    if (char === "\\") {
      index += 1;
      continue;
    }

    if (char === "[") {
      inClass = true;
      continue;
    }

    if (char === "]") {
      inClass = false;
      continue;
    }

    if (char === "/" && !inClass) {
      while (/[a-z]/i.test(source[index + 1] || "")) {
        index += 1;
      }
      return index;
    }
  }

  throw new Error("unterminated regex literal");
}

function skipLineComment(source, start) {
  const offset = source.slice(start).search(RE.lineBreak);
  return offset === -1 ? source.length : start + offset;
}

function skipBlockComment(source, start) {
  const end = source.indexOf("*/", start);
  return end === -1 ? source.length : end + 1;
}

function isQuote(char) {
  return char === "'" || char === '"';
}

function isLineComment(char, next) {
  return char === "/" && next === "/";
}

function isBlockComment(char, next) {
  return char === "/" && next === "*";
}

function encodeRuntime(runtime) {
  return encodeURIComponent(runtime).replace(RE.urlExtra, (char) => {
    return `%${char.charCodeAt(0).toString(16).toUpperCase()}`;
  });
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${content}\n`, "utf8");
}

function getEncodedFile(rawFile) {
  const dir = path.dirname(rawFile);
  const ext = path.extname(rawFile) || ".txt";
  const name = path.basename(rawFile, path.extname(rawFile));

  return path.join(dir, `${name}.encoded${ext}`);
}

function printSummary(build) {
  console.log(`Built ${relative(build.rawFile)}`);
  console.log(`Built ${relative(build.encodedFile)}`);
  console.log(`Source: ${relative(build.sourceFile)}`);
  console.log(`Source size: ${build.source.length.toLocaleString()} chars`);
  console.log(`Compact runtime size: ${build.minified.length.toLocaleString()} chars`);
  console.log(`Raw bookmarklet size: ${build.raw.length.toLocaleString()} chars`);
  console.log(`Encoded bookmarklet size: ${build.encoded.length.toLocaleString()} chars`);
}

function relative(file) {
  return path.relative(process.cwd(), file);
}
