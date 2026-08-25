/**
 * Module resolve hook that lets a plain Node script import this repo's
 * TypeScript directly.
 *
 * Node can already *execute* TypeScript (it strips the types), but its ESM
 * resolver still requires a file extension on every relative specifier, while
 * the app's own code is written for the bundler's extensionless resolution
 * (`import { createLogger } from "../logger"`). This bridges the two by trying
 * the TypeScript extensions when an extensionless relative import misses.
 *
 * Registered by scripts that want it — see test-grandid-connection.mjs. It is
 * never part of the app build.
 */

import { existsSync } from "fs";
import { fileURLToPath } from "url";

const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const hasExtension = /\.[mc]?[jt]sx?$/.test(specifier);

  if (isRelative && !hasExtension && context.parentURL) {
    const base = new URL(specifier, context.parentURL);
    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = new URL(base.href + suffix);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context);
      }
    }
  }

  return nextResolve(specifier, context);
}
