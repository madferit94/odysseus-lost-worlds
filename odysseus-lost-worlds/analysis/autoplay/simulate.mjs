#!/usr/bin/env node
// Batch autoplay: plays many full journeys of the real game with bots and writes
// runs.csv, summary.json, REPORT.md and REPORT.ko.md.
//
//   node analysis/autoplay/simulate.mjs                 # 200 runs per difficulty x bot (default, 6 bots)
//   node analysis/autoplay/simulate.mjs --runs 20       # quick look
//   node analysis/autoplay/simulate.mjs --one aegean average 7   # one run, printed as JSON
//   node analysis/autoplay/simulate.mjs --report-only   # rebuild reports from summary.json
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
import {simulateRun} from './run.mjs';
import {SKILLS, MAIN_SKILLS, REFERENCE_SKILLS, DIFFICULTIES} from './skills.mjs';
import {aggregateCell, rankSpikes, CSV_COLUMNS, csvRow} from './aggregate.mjs';
import {writeReports} from './report.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

if (!isMainThread) {
  const out = [];
  for (const t of workerData.tasks) out.push(simulateRun(t));
  parentPort.postMessage(out);
} else {
  await main();
}

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i < 0 ? fallback : process.argv[i + 1];
}

async function main() {
  const outDir = path.resolve(arg('out', path.join(HERE, 'results')));
  if (process.argv.includes('--report-only')) {
    const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'summary.json'), 'utf8'));
    writeReports(summary, outDir);
    console.log('Reports rebuilt in ' + outDir);
    return;
  }
  const one = process.argv.indexOf('--one');
  if (one >= 0) {
    const [difficulty, skill, seed] = process.argv.slice(one + 1, one + 4);
    console.log(JSON.stringify(simulateRun({difficulty, skill, seed: Number(seed)}), null, 1));
    return;
  }
  const runs = Number(arg('runs', 200)), firstSeed = Number(arg('seed', 1));
  const skills = arg('skills', [...MAIN_SKILLS, ...REFERENCE_SKILLS].join(',')).split(','), difficulties = arg('difficulties', DIFFICULTIES.join(',')).split(',');
  const workers = Math.max(1, Number(arg('workers', Math.max(1, os.cpus().length - 1))));
  const tasks = [];
  for (const difficulty of difficulties) for (const skill of skills) for (let i = 0; i < runs; i++) tasks.push({difficulty, skill, seed: firstSeed + i});
  console.log(`Playing ${tasks.length} runs (${difficulties.length} difficulties x ${skills.length} skills x ${runs} seeds) on ${workers} workers...`);
  const started = Date.now();
  const chunks = Array.from({length: workers}, (_, w) => tasks.filter((_, i) => i % workers === w));
  const parts = await Promise.all(chunks.filter(c => c.length).map(chunk => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), {workerData: {tasks: chunk}});
    w.once('message', resolve); w.once('error', reject);
  })));
  const order = (r) => [difficulties.indexOf(r.difficulty), skills.indexOf(r.skill), r.seed];
  const results = parts.flat().sort((a, b) => { const x = order(a), y = order(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
  const seconds = (Date.now() - started) / 1000;
  console.log(`Done in ${seconds.toFixed(1)} s wall time.`);

  fs.mkdirSync(outDir, {recursive: true});
  fs.writeFileSync(path.join(outDir, 'runs.csv'), [CSV_COLUMNS.join(','), ...results.map(csvRow)].join('\n') + '\n');
  const cells = {};
  for (const d of difficulties) for (const s of skills) cells[d + '/' + s] = aggregateCell(results.filter(r => r.difficulty === d && r.skill === s));
  const mainSkills = skills.filter(s => MAIN_SKILLS.includes(s));
  const summary = {
    meta: {
      runsPerCell: runs, seeds: [firstSeed, firstSeed + runs - 1], totalRuns: results.length, wallSeconds: Math.round(seconds),
      workers, gameSecondsPlayed: Math.round(results.reduce((a, r) => a + r.gameSeconds, 0)),
      frameStep: '1/60 s', maxGameSeconds: 3600, stuckSeconds: 180, weapon: 'bronze sword (default, never switched)', node: process.version,
    },
    difficulties, skills, profiles: Object.fromEntries(skills.map(s => [s, SKILLS[s]])),
    cells,
    spikes: Object.fromEntries(mainSkills.map(s => [s, rankSpikes(cells, s, difficulties)])),
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
  writeReports(summary, outDir);
  const size = fs.statSync(path.join(outDir, 'runs.csv')).size;
  console.log(`Wrote runs.csv (${(size / 1e6).toFixed(2)} MB), summary.json, REPORT.md, REPORT.ko.md to ${outDir}`);
  for (const d of difficulties) console.log(d.padEnd(7), skills.map(s => `${s} ${(100 * cells[d + '/' + s].clearRate.p).toFixed(0)}%`).join('  '));
}
