import assert from "node:assert/strict";
import { trimChangelogForSite } from "../src/lib/changelog.ts";

const source = `# Changelog

Introductory copy.

## [Unreleased]

- Pending change.

## [15.0.0] - 2026-09-01

- Newest release.

## [14.0.0] - 2026-08-01

- Second release.

## [13.0.0] - 2026-07-01

- Third release.

## [12.0.0] - 2026-06-01

- Fourth release.

## [11.0.0] - 2026-05-01

- First hidden release.
`;

const trimmed = trimChangelogForSite(source);
assert.match(trimmed, /^# Changelog/m);
assert.match(trimmed, /^## \[Unreleased\]/m);
assert.match(trimmed, /^## \[15\.0\.0\]/m);
assert.match(trimmed, /^## \[14\.0\.0\]/m);
assert.match(trimmed, /^## \[13\.0\.0\]/m);
assert.match(trimmed, /^## \[12\.0\.0\]/m);
assert.doesNotMatch(trimmed, /^## \[11\.0\.0\]/m);
assert.doesNotMatch(trimmed, /First hidden release/);
assert.match(trimmed, /^## Earlier releases$/m);
assert.match(
  trimmed,
  /https:\/\/github\.com\/coastal-ms\/DST-DuneServerTool\/blob\/main\/CHANGELOG\.md/,
);

const nextRelease = source.replace(
  "## [15.0.0]",
  "## [16.0.0] - 2026-10-01\n\n- New rolling release.\n\n## [15.0.0]",
);
const rolled = trimChangelogForSite(nextRelease);
assert.match(rolled, /^## \[16\.0\.0\]/m);
assert.match(rolled, /^## \[13\.0\.0\]/m);
assert.doesNotMatch(rolled, /^## \[12\.0\.0\]/m);

const fewerThanFour = `# Changelog

## [Unreleased]

## [3.0.0] - 2026-03-01

## [2.0.0] - 2026-02-01

## [1.0.0] - 2026-01-01
`;
assert.equal(trimChangelogForSite(fewerThanFour), fewerThanFour);

const malformed = `# Changelog

## [Unreleased]

## Legacy archive
`;
assert.equal(trimChangelogForSite(malformed), malformed);

console.log("Changelog transformation checks passed.");
