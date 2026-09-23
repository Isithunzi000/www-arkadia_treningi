#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const RELEASES = path.join(__dirname, '..', 'releases');
const DIST     = path.join(__dirname, '..', 'dist');

fs.mkdirSync(DIST, { recursive: true });

const allZips = fs.readdirSync(RELEASES).filter(function (f) { return f.endsWith('.zip'); });
if (!allZips.length) {
  console.error('BLAD: brak zipow w releases/ — pustego dist/ nie wolno publikowac');
  process.exit(1);
}

function parseVersion(filename) {
  var m = filename.match(/_(\d+)_(\d+)_(\d+)\.zip$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

var zips = allZips.filter(function (f) {
  if (!parseVersion(f)) {
    console.error('POMINIETY (nieparsowalna nazwa): ' + f);
    return false;
  }
  return true;
});
if (!zips.length) {
  console.error('BLAD: zaden zip w releases/ nie ma parsowalnej wersji');
  process.exit(1);
}

function versionCmp(a, b) {
  var pa = parseVersion(a), pb = parseVersion(b);
  for (var i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pb[i] - pa[i];
  }
  return 0;
}

zips.sort(versionCmp);
var latestZip = zips[0];
var vParts    = parseVersion(latestZip);
var version   = vParts.join('.');

// Guard spojnosci wersji (B2): nazwa zipa == EXT_VERSION w zrodle ==
// version w manifest.json. Zle nazwany zip nie moze wdrozyc sie po cichu
// pod blednym numerem - mismatch przerywa build.
function unzipText(zipFile, entry) {
  return require('child_process').execSync(
    'unzip -p "' + path.join(RELEASES, zipFile) + '" "' + entry + '"',
    { encoding: 'utf8' });
}

var pkgDir  = 'arkadia_treningi';
var srcText = unzipText(latestZip, pkgDir + '/treningi.js');
var mExt    = srcText.match(/var EXT_VERSION\s*=\s*'([^']+)'/);
var manVer  = JSON.parse(unzipText(latestZip, pkgDir + '/manifest.json')).version;
var extVer  = mExt && mExt[1];
if (extVer !== version || manVer !== version) {
  console.error('BLAD: niespojnosc wersji w ' + latestZip +
    ': nazwa=' + version + ' EXT_VERSION=' + extVer + ' manifest=' + manVer);
  process.exit(1);
}
console.log('Guard wersji OK: ' + version);

fs.copyFileSync(path.join(RELEASES, latestZip), path.join(DIST, latestZip));
fs.copyFileSync(path.join(RELEASES, latestZip), path.join(DIST, 'arkadia_treningi.zip'));

var index = {
  built:   new Date().toISOString(),
  version: version,
  zip:     latestZip,
};

fs.writeFileSync(path.join(DIST, 'index.json'), JSON.stringify(index, null, 2));

console.log('Gotowe: ' + latestZip + ' -> dist/' + latestZip + ' + dist/arkadia_treningi.zip');
console.log('index.json: version=' + version);
fs.readdirSync(DIST).forEach(function (f) { console.log('  dist/' + f); });
