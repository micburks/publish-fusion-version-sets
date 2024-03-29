#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const util = require('util');
const toml = require('toml');
const cp = require('child_process');

const readDir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const execFile = util.promisify(cp.execFile);
const stat = util.promisify(fs.stat);

if (process.argv.length < 3) {
  console.error('must supply a path to the release directory');
  process.exit(1);
}

const releaseDir = path.resolve(process.argv[2]);
const dryRun = process.argv[3] && process.argv[3] === '--dry-run';
const fusionVersionPath = path.resolve('./fusion-version');
const fusionVersionMetaPath = path.join(fusionVersionPath, 'package.json');
const fusionVersionMeta = require(fusionVersionMetaPath);

getReleases(releaseDir, fusionVersionMeta.version)
  .then(async releases => {
    for (const release of releases) {
      try {
        await writeVersions(release);
        await execFile('npm', ['version', release.version, '--allow-same-version'], {
          cwd: fusionVersionPath,
        });
        await execFile('npm', ['publish', dryRun && '--dry-run'].filter(Boolean), {
          cwd: fusionVersionPath,
        });
        console.log(`${release.name} published successfully`);
      } catch (e) {
        console.error(`error publishing ${release.name}`);
        console.error(e);
      }
    }
  });

async function getReleases(dir, initialVersion) {
  const releases = await Promise.all(
    (await readDir(dir)).map(async release => {
      const releasePath = path.join(releaseDir, release, 'release.toml');
      const stats = await stat(releasePath);
      return {
        name: release,
        path: releasePath,
        ts: stats.birthtimeMs,
      };
    })
  );
  // this sort is not exactly accurate
  releases.sort((a, b) => a.ts - b.ts);
  let [major, minor, patch] = initialVersion.split('.');
  return releases.map(release => ({
    ...release,
    version: `${major}.${minor}.${patch++}`,
  }));
}

async function writeVersions(release) {
  const versionSet = toml.parse(
    await readFile(release.path)
  );
  const fusionVersionMetaCopy = JSON.parse(
    JSON.stringify(fusionVersionMeta)
  );
  for (const package in fusionVersionMetaCopy.devDependencies) {
    if (versionSet[package]) {
      fusionVersionMetaCopy.devDependencies[package] = versionSet[package].version;
    } else if (fusionVersionMetaCopy.devDependencies[package] === '0.0.0-monorepo') {
      // account for packages that have been added since a given release
      delete fusionVersionMetaCopy.devDependencies[package];
    }
  }
  await writeFile(
    fusionVersionMetaPath,
    JSON.stringify(fusionVersionMetaCopy, null, 2),
  );
}
