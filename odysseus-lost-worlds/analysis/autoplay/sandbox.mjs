// Loads the real game scripts into a Node vm sandbox with a fake page, a seeded
// Math.random and a telemetry stub that records the game's own analytics events.
// Nothing here edits game files: they are only read.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const GAME_DIR = path.resolve(HERE, '../..');
// Same order as index.html (rendering-only and network files are left out).
export const GAME_FILES = ['art.js','gods.js','achilles.js','caocao.js','weapons.js','progression.js','combat.js','characters.js','ui.js','game.js','telemetry-hooks.js'];
const BOT_FILE = path.join(HERE, 'bot.js');

let compiled = null;
function scripts() {
  if (!compiled) compiled = [...GAME_FILES.map(f => path.join(GAME_DIR, f)), BOT_FILE]
    .map(file => new vm.Script(fs.readFileSync(file, 'utf8'), {filename: file}));
  return compiled;
}

// Small, fast, well-mixed 32-bit generator. Same seed -> same sequence.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seedFor(...parts) {
  let h = 2166136261;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function createGame(seed) {
  const noop = () => {}, elements = new Map(), handlers = {}, events = [];
  const draw = new Proxy({}, {get: () => noop, set: () => true});
  const element = id => {
    if (!elements.has(id)) elements.set(id, {id, getContext: () => draw, classList: {add: noop, remove: noop}, focus: noop, setAttribute: noop, attributes: {}, textContent: '', innerHTML: '', hidden: false});
    return elements.get(id);
  };
  const math = Object.create(Math);
  math.random = mulberry32(seedFor(seed, 'game'));
  const context = vm.createContext({
    console, Math: math,
    Image: class { constructor() { this.complete = false; this.naturalWidth = 0; } },
    document: {getElementById: element, addEventListener: noop, hidden: false},
    window: {addEventListener: (name, fn) => { handlers[name] = fn; }, matchMedia: () => ({matches: false})},
    requestAnimationFrame: noop,
    telemetry: {
      begin: noop, flush: noop, display: noop,
      emit: (name, snapshot, extra = {}) => events.push({name, ...snapshot, ...extra}),
    },
  });
  for (const s of scripts()) s.runInContext(context);
  vm.runInContext('audio=()=>{};', context);
  const canvas = element('game');
  const press = (type, code, key) => handlers[type]?.({code, key, target: canvas, repeat: false, preventDefault: noop, ctrlKey: false, altKey: false, metaKey: false});
  return {context, events, press, run: code => vm.runInContext(code, context)};
}
