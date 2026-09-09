import { readFile } from "node:fs/promises";
import { join } from "node:path";

const CHANGELOG_PATH = join(process.cwd(), "..", "CHANGELOG.md");
const RELEASE_LIMIT = 4;
const NUMERIC_RELEASE_HEADING = /^## \[(\d+)\.[^\]]+\][^\r\n]*$/gm;
const EARLIER_RELEASES = `## Earlier releases

[View the complete changelog on GitHub](https://github.com/coastal-ms/DST-DuneServerTool/blob/main/CHANGELOG.md) for all earlier releases.`;

export function trimChangelogForSite(source: string): string {
  const firstHiddenRelease = [
    ...source.matchAll(NUMERIC_RELEASE_HEADING),
  ][RELEASE_LIMIT];

  if (firstHiddenRelease?.index === undefined) {
    return source;
  }

  return `${source.slice(0, firstHiddenRelease.index).trimEnd()}\n\n${EARLIER_RELEASES}\n`;
}

export async function getChangelog(): Promise<string> {
  try {
    const source = await readFile(CHANGELOG_PATH, "utf8");
    return trimChangelogForSite(source);
  } catch (err) {
    console.warn("[changelog] read failed:", err);
    return "# Changelog\n\n_Changelog could not be loaded._";
  }
}
