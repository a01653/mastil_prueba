import React, { useEffect, useMemo, useState } from "react";

// Mástil interactivo
// - Escalas: pentatónicas (mayor/menor), mayor/menor natural, modos
// - Resaltado: raíz, 3ª, 5ª + extras
// - Vista: notas / intervalos
// - Patrones "reales":
//   * Pentatónicas: 5 boxes
//   * Escalas de 7 notas: 3NPS (7 patrones)
// - Ruta "musical": recorre la escala en orden (asc/desc por altura) y se restringe a patrones.
// - Notación: auto #/b según armadura (con override manual)

const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const SCALE_PRESETS = {
  "Pentatónica mayor": [0, 2, 4, 7, 9],
  "Pentatónica menor": [0, 3, 5, 7, 10],

  "Escala mayor": [0, 2, 4, 5, 7, 9, 11],
  "Escala menor (natural)": [0, 2, 3, 5, 7, 8, 10],

  "Jónica (Ionian)": [0, 2, 4, 5, 7, 9, 11],
  "Dórica (Dorian)": [0, 2, 3, 5, 7, 9, 10],
  "Frigia (Phrygian)": [0, 1, 3, 5, 7, 8, 10],
  "Lidia (Lydian)": [0, 2, 4, 6, 7, 9, 11],
  "Mixolidia (Mixolydian)": [0, 2, 4, 5, 7, 9, 10],
  "Eólica (Aeolian)": [0, 2, 3, 5, 7, 8, 10],
  "Locria (Locrian)": [0, 1, 3, 5, 6, 8, 10],

  "Personalizada": null,
};

// Afinación estándar (UI: 1ª→6ª)
const STRINGS = [
  { label: "1ª (E)", pc: 4 },
  { label: "2ª (B)", pc: 11 },
  { label: "3ª (G)", pc: 7 },
  { label: "4ª (D)", pc: 2 },
  { label: "5ª (A)", pc: 9 },
  { label: "6ª (E)", pc: 4 },
];

// MIDI aproximado cuerdas al aire (E4,B3,G3,D3,A2,E2)
const OPEN_MIDI = [64, 59, 55, 50, 45, 40];

const FRET_MARKERS = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const IONIAN_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

function mod12(n) {
  const x = n % 12;
  return x < 0 ? x + 12 : x;
}

function pcToName(pc, preferSharps) {
  const list = preferSharps ? NOTES_SHARP : NOTES_FLAT;
  return list[mod12(pc)];
}

function pitchAt(sIdx, fret) {
  return OPEN_MIDI[sIdx] + fret;
}

function noteNameToPc(token) {
  const t = token.trim().toUpperCase();
  if (!t) return null;

  const letter = t[0];
  if (!NATURAL_PC.hasOwnProperty(letter)) return null;

  let pc = NATURAL_PC[letter];
  const accidental = t.slice(1);

  if (accidental === "#") pc += 1;
  else if (accidental === "B") pc -= 1;
  else if (accidental === "##") pc += 2;
  else if (accidental === "BB") pc -= 2;
  else if (accidental) return null;

  return mod12(pc);
}

function degreeTokenToSemitones(token) {
  // grados vs escala mayor: 1=0,2=2,3=4,4=5,5=7,6=9,7=11
  // IMPORTANTE: aquí SOLO aceptamos grados 1–7 (para no confundir con semitonos "10" etc.)
  const t = token.trim();
  if (!t) return null;
  const m = t.match(/^([b#]{0,2})([0-9]+)$/i);
  if (!m) return null;

  const acc = (m[1] || "").toLowerCase();
  const degRaw = parseInt(m[2], 10);
  if (!Number.isFinite(degRaw) || degRaw < 1 || degRaw > 7) return null;

  const deg = degRaw;
  const majorDegreeToSemi = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };
  let semi = majorDegreeToSemi[deg];

  for (const ch of acc) {
    if (ch === "b") semi -= 1;
    if (ch === "#") semi += 1;
  }

  return mod12(semi);
}

function intervalToDegreeToken(semi) {
  // cromático relativo a la raíz
  const map = ["1", "b2", "2", "b3", "3", "4", "#4", "5", "b6", "6", "b7", "7"];
  return map[mod12(semi)];
}

function degreeNumberFromInterval(interval) {
  const tok = intervalToDegreeToken(interval);
  const n = parseInt(tok.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 1;
}

function spellPcWithLetter(targetPc, letter) {
  const base = NATURAL_PC[letter];
  let diff = ((targetPc - base + 6) % 12) - 6; // -6..5

  // Para nuestras escalas, normalmente cae en -2..2.
  // Si no, se fuerza a la representación más cercana.
  if (diff > 2) diff -= 12;
  if (diff < -2) diff += 12;

  let acc = "";
  if (diff === 1) acc = "#";
  else if (diff === 2) acc = "##";
  else if (diff === -1) acc = "b";
  else if (diff === -2) acc = "bb";
  else if (diff !== 0) acc = diff > 0 ? "#".repeat(diff) : "b".repeat(-diff);

  return `${letter}${acc}`;
}

function spellScaleNotes({ rootPc, scaleIntervals, preferSharps }) {
  const rootName = pcToName(rootPc, preferSharps);
  const rootLetter = rootName[0];
  const rootIdx = Math.max(0, LETTERS.indexOf(rootLetter));

  return scaleIntervals.map((interval) => {
    const deg = degreeNumberFromInterval(interval);
    const letter = LETTERS[(rootIdx + (deg - 1)) % 7];
    const pc = mod12(rootPc + interval);
    return spellPcWithLetter(pc, letter);
  });
}

function parseTokensToIntervals({ input, rootPc }) {
  const clean = (input || "").replaceAll(",", " ").trim();
  const raw = clean ? clean.split(/ +/).map((x) => x.trim()).filter(Boolean) : [];

  const intervals = [];
  for (const tok of raw) {
    // Semitonos explícitos: s0..s11 (ej: s3)
    const sm = tok.match(/^s(-?[0-9]+)$/i);
    if (sm) {
      intervals.push(mod12(parseInt(sm[1], 10)));
      continue;
    }

    // Grados (1..7, con b/#): 1, b3, #4...
    const degSemi = degreeTokenToSemitones(tok);
    if (degSemi !== null) {
      intervals.push(degSemi);
      continue;
    }

    // Semitonos puros (0..11). Ojo: 1..7 se tratan como grados arriba.
    if (/^-?[0-9]+$/.test(tok)) {
      const n = parseInt(tok, 10);
      if (Number.isFinite(n)) intervals.push(mod12(n));
      continue;
    }

    // Notas (F, Ab, C#...)
    const pc = noteNameToPc(tok);
    if (pc !== null) {
      intervals.push(mod12(pc - rootPc));
      continue;
    }
  }

  // La raíz siempre está
  intervals.push(0);
  return Array.from(new Set(intervals.map(mod12))).sort((a, b) => a - b);
}

function buildScaleIntervals(scaleName, customInput, rootPc) {
  const preset = SCALE_PRESETS[scaleName];
  if (preset) return preset;
  return parseTokensToIntervals({ input: customInput, rootPc });
}

function pickThirdOffsets(intervals) {
  const set = new Set(intervals.map(mod12));
  const thirds = [];
  if (set.has(3)) thirds.push(3);
  if (set.has(4)) thirds.push(4);
  return thirds;
}

function hexToRgb(hex) {
  const h = (hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function rgba(hex, a) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${a})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

function isDark(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const y = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return y < 0.55;
}

function parsePosCode(code) {
  // <cuerda><traste> ej: 11 => cuerda 1 traste 1; 610 => cuerda 6 traste 10
  const s = String(code || "").trim();
  const m = s.match(/^([1-6])([0-9]{1,2})$/);
  if (!m) return null;
  const stringNumber = parseInt(m[1], 10);
  const fret = parseInt(m[2], 10);
  if (!Number.isFinite(fret) || fret < 0 || fret > 24) return null;
  return { stringNumber, sIdx: stringNumber - 1, fret };
}

function positionsForPitch(pitch, maxFret) {
  const out = [];
  for (let sIdx = 0; sIdx < 6; sIdx++) {
    const fret = pitch - OPEN_MIDI[sIdx];
    if (Number.isInteger(fret) && fret >= 0 && fret <= maxFret) {
      out.push({ sIdx, fret, pc: mod12(STRINGS[sIdx].pc + fret) });
    }
  }
  return out;
}

function findRootFretsOnLowE(rootPc, maxFret) {
  const lowE = STRINGS[5].pc;
  const out = [];
  for (let fret = 0; fret <= maxFret; fret++) {
    if (mod12(lowE + fret) === mod12(rootPc)) out.push(fret);
  }
  return out;
}

function buildMembershipMap(patterns) {
  const map = new Map();
  for (const p of patterns) {
    for (const key of p.cells) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p.idx);
    }
  }
  for (const [k, arr] of map.entries()) {
    arr.sort((a, b) => a - b);
    map.set(k, arr);
  }
  return map;
}

// ------------------------
// Auto armadura (#/b)
// ------------------------
function getParentMajorTonicPc({ rootPc, scaleName }) {
  // Modos: tonic del mayor (jónico) que comparte armadura.
  // Dórica = 2º grado, etc.
  const modeDegreeByName = {
    "Jónica (Ionian)": 1,
    "Dórica (Dorian)": 2,
    "Frigia (Phrygian)": 3,
    "Lidia (Lydian)": 4,
    "Mixolidia (Mixolydian)": 5,
    "Eólica (Aeolian)": 6,
    "Locria (Locrian)": 7,
  };

  if (scaleName === "Escala mayor") return rootPc;
  if (scaleName === "Pentatónica mayor") return rootPc;

  // Menores: armadura de la relativa mayor
  if (scaleName === "Escala menor (natural)" || scaleName === "Pentatónica menor") {
    return mod12(rootPc + 3);
  }

  if (modeDegreeByName[scaleName]) {
    const deg = modeDegreeByName[scaleName];
    return mod12(rootPc - IONIAN_INTERVALS[deg - 1]);
  }

  // Personalizada: no sabemos
  return rootPc;
}

function preferSharpsFromMajorTonicPc(tonicPc) {
  // Heurística "armadura típica" (mayor).
  // Flats: F, Bb, Eb, Ab, Db
  // Sharps: G, D, A, E, B
  // Ambiguos (F#/Gb, C#/Db) se deciden por convención simple.
  const flats = new Set([5, 10, 3, 8, 1]);
  const sharps = new Set([7, 2, 9, 4, 11]);
  if (flats.has(tonicPc)) return false;
  if (sharps.has(tonicPc)) return true;
  if (tonicPc === 6) return true; // F# vs Gb (tie)
  return true; // C o por defecto
}

function computeAutoPreferSharps({ rootPc, scaleName }) {
  const parent = getParentMajorTonicPc({ rootPc, scaleName });
  return preferSharpsFromMajorTonicPc(parent);
}

// ------------------------
// Patrones "reales"
// ------------------------

// Pentatónicas: 5 boxes
const PENTA_BOX_STARTS_FROM_ROOT = [0, 2, 4, 7, 9];
const PENTA_BOX_OFFSETS = [
  // Box 1
  [[0, 3], [0, 3], [0, 2], [0, 2], [0, 2], [0, 3]],
  // Box 2
  [[1, 3], [1, 3], [0, 2], [0, 3], [0, 3], [1, 3]],
  // Box 3
  [[1, 3], [1, 4], [0, 3], [0, 3], [1, 3], [1, 3]],
  // Box 4
  [[0, 3], [1, 3], [0, 2], [0, 2], [0, 3], [0, 3]],
  // Box 5
  [[1, 3], [1, 3], [0, 2], [0, 3], [0, 3], [1, 3]],
];

function buildPentBoxPatternsMerged({ rootPc, maxFret }) {
  // Legacy (no usado en rutas/patrones actuales; mantenido por compatibilidad)
  const rootFrets = findRootFretsOnLowE(rootPc, maxFret);

  const merged = Array.from({ length: 5 }, (_, idx) => ({
    idx,
    name: `Box ${idx + 1}`,
    cells: new Set(),
  }));

  for (const rootFret of rootFrets) {
    for (let b = 0; b < 5; b++) {
      const posStart = rootFret + PENTA_BOX_STARTS_FROM_ROOT[b];
      for (let sIdx = 0; sIdx < 6; sIdx++) {
        for (const off of PENTA_BOX_OFFSETS[b][sIdx]) {
          const fret = posStart + off;
          if (fret < 0 || fret > maxFret) continue;
          merged[b].cells.add(`${sIdx}:${fret}`);
        }
      }
    }
  }

  return merged;
}

// 2NPS: 5 patrones para cualquier escala de 5 notas (pentatónicas mayor/menor)
function build2NpsPatternsMerged({ rootPc, scaleIntervals, maxFret }) {
  if (scaleIntervals.length !== 5) return [];

  const rootFrets = findRootFretsOnLowE(rootPc, maxFret);
  const deltas = scaleIntervals.map((_, i) => {
    const a = scaleIntervals[i];
    const b = scaleIntervals[(i + 1) % 5];
    const d = (b - a + 12) % 12;
    return d === 0 ? 12 : d;
  });

  const merged = Array.from({ length: 5 }, (_, idx) => ({
    idx,
    name: `2NPS ${idx + 1}`,
    cells: new Set(),
  }));

  for (const rootFret of rootFrets) {
    for (let p = 0; p < 5; p++) {
      const startFret = rootFret + scaleIntervals[p];
      if (startFret < 0 || startFret > maxFret) continue;

      const startPitch = pitchAt(5, startFret);

      // 12 pitches ascendiendo (2 por cuerda)
      const pitches = [startPitch];
      let curPitch = startPitch;
      let deg = p;
      for (let k = 1; k < 12; k++) {
        const step = deltas[deg % 5];
        curPitch += step;
        pitches.push(curPitch);
        deg = (deg + 1) % 5;
      }

      // 2 por cuerda, 6ª→1ª
      let idxPitch = 0;
      for (let sIdx = 5; sIdx >= 0; sIdx--) {
        const p1 = pitches[idxPitch++];
        const p2 = pitches[idxPitch++];

        const f1 = p1 - OPEN_MIDI[sIdx];
        const f2 = p2 - OPEN_MIDI[sIdx];

        for (const fret of [f1, f2]) {
          if (!Number.isInteger(fret)) continue;
          if (fret < 0 || fret > maxFret) continue;
          merged[p].cells.add(`${sIdx}:${fret}`);
        }
      }
    }
  }

  return merged;
}

// 3NPS: 7 patrones para una escala de 7 notas
function build3NpsPatternsMerged({ rootPc, scaleIntervals, maxFret }) {
  if (scaleIntervals.length !== 7) return [];

  const rootFrets = findRootFretsOnLowE(rootPc, maxFret);
  const deltas = scaleIntervals.map((_, i) => {
    const a = scaleIntervals[i];
    const b = scaleIntervals[(i + 1) % 7];
    const d = (b - a + 12) % 12;
    return d === 0 ? 12 : d;
  });

  const merged = Array.from({ length: 7 }, (_, idx) => ({
    idx,
    name: `3NPS ${idx + 1}`,
    cells: new Set(),
  }));

  for (const rootFret of rootFrets) {
    for (let p = 0; p < 7; p++) {
      const startFret = rootFret + scaleIntervals[p];
      if (startFret < 0 || startFret > maxFret) continue;

      const startPitch = pitchAt(5, startFret);

      // 18 pitches ascendiendo
      const pitches = [startPitch];
      let curPitch = startPitch;
      let deg = p;
      for (let k = 1; k < 18; k++) {
        const step = deltas[deg % 7];
        curPitch += step;
        pitches.push(curPitch);
        deg = (deg + 1) % 7;
      }

      // 3 por cuerda, 6ª→1ª (sIdx 5..0)
      let idxPitch = 0;
      for (let sIdx = 5; sIdx >= 0; sIdx--) {
        const p1 = pitches[idxPitch++];
        const p2 = pitches[idxPitch++];
        const p3 = pitches[idxPitch++];

        const f1 = p1 - OPEN_MIDI[sIdx];
        const f2 = p2 - OPEN_MIDI[sIdx];
        const f3 = p3 - OPEN_MIDI[sIdx];

        for (const fret of [f1, f2, f3]) {
          if (!Number.isInteger(fret)) continue;
          if (fret < 0 || fret > maxFret) continue;
          merged[p].cells.add(`${sIdx}:${fret}`);
        }
      }
    }
  }

  return merged;
}

// ------------------------
// Patrones como *instancias* (clave para evitar saltos absurdos)
// ------------------------

function build2NpsPatternInstances({ rootPc, scaleIntervals, maxFret }) {
  if (scaleIntervals.length !== 5) return [];

  const rootFrets = findRootFretsOnLowE(rootPc, maxFret);
  const deltas = scaleIntervals.map((_, i) => {
    const a = scaleIntervals[i];
    const b = scaleIntervals[(i + 1) % 5];
    const d = (b - a + 12) % 12;
    return d === 0 ? 12 : d;
  });

  const instances = [];
  const seen = new Set();

  for (const rootFret of rootFrets) {
    for (let p = 0; p < 5; p++) {
      const startFret = rootFret + scaleIntervals[p];
      if (startFret < 0 || startFret > maxFret) continue;

      const key = `${p}@${startFret}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const startPitch = pitchAt(5, startFret);

      // 12 pitches ascendiendo (2 por cuerda)
      const pitches = [startPitch];
      let curPitch = startPitch;
      let deg = p;
      for (let k = 1; k < 12; k++) {
        const step = deltas[deg % 5];
        curPitch += step;
        pitches.push(curPitch);
        deg = (deg + 1) % 5;
      }

      const cells = new Set();
      let idxPitch = 0;
      for (let sIdx = 5; sIdx >= 0; sIdx--) {
        const p1 = pitches[idxPitch++];
        const p2 = pitches[idxPitch++];

        const f1 = p1 - OPEN_MIDI[sIdx];
        const f2 = p2 - OPEN_MIDI[sIdx];

        for (const fret of [f1, f2]) {
          if (!Number.isInteger(fret)) continue;
          if (fret < 0 || fret > maxFret) continue;
          cells.add(`${sIdx}:${fret}`);
        }
      }

      if (cells.size >= 8) {
        instances.push({
          typeIdx: p,
          anchorFret: startFret,
          rootFret,
          name: `2NPS ${p + 1} @${startFret}`,
          cells,
        });
      }
    }
  }

  return instances;
}

function build3NpsPatternInstances({ rootPc, scaleIntervals, maxFret }) {
  if (scaleIntervals.length !== 7) return [];

  const rootFrets = findRootFretsOnLowE(rootPc, maxFret);
  const deltas = scaleIntervals.map((_, i) => {
    const a = scaleIntervals[i];
    const b = scaleIntervals[(i + 1) % 7];
    const d = (b - a + 12) % 12;
    return d === 0 ? 12 : d;
  });

  const instances = [];
  const seen = new Set();

  for (const rootFret of rootFrets) {
    for (let p = 0; p < 7; p++) {
      const startFret = rootFret + scaleIntervals[p];
      if (startFret < 0 || startFret > maxFret) continue;

      const key = `${p}@${startFret}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const startPitch = pitchAt(5, startFret);

      // 18 pitches ascendiendo
      const pitches = [startPitch];
      let curPitch = startPitch;
      let deg = p;
      for (let k = 1; k < 18; k++) {
        const step = deltas[deg % 7];
        curPitch += step;
        pitches.push(curPitch);
        deg = (deg + 1) % 7;
      }

      const cells = new Set();
      let idxPitch = 0;
      for (let sIdx = 5; sIdx >= 0; sIdx--) {
        const p1 = pitches[idxPitch++];
        const p2 = pitches[idxPitch++];
        const p3 = pitches[idxPitch++];

        const f1 = p1 - OPEN_MIDI[sIdx];
        const f2 = p2 - OPEN_MIDI[sIdx];
        const f3 = p3 - OPEN_MIDI[sIdx];

        for (const fret of [f1, f2, f3]) {
          if (!Number.isInteger(fret)) continue;
          if (fret < 0 || fret > maxFret) continue;
          cells.add(`${sIdx}:${fret}`);
        }
      }

      if (cells.size >= 12) {
        instances.push({
          typeIdx: p,
          anchorFret: startFret,
          rootFret,
          name: `3NPS ${p + 1} @${startFret}`,
          cells,
        });
      }
    }
  }

  return instances;
}

function buildInstanceMembershipMap(instances) {
  // cellKey -> [instanceIndex...]
  const map = new Map();
  for (let i = 0; i < instances.length; i++) {
    for (const key of instances[i].cells) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(i);
    }
  }
  for (const [k, arr] of map.entries()) {
    arr.sort((a, b) => a - b);
    map.set(k, arr);
  }
  return map;
}

// ------------------------
// Pentatónicas: cajas (5 boxes) por ventanas de 5 trastes
// NOTA: en pentatónicas el concepto "box" es posicional; dejamos 2–3 notas/cuerda según ventana.
// ------------------------

const PENTA_BOX_START_OFFSETS = [0, 3, 5, 7, 10];

function buildPentatonicBoxInstances({ rootPc, scaleIntervals, maxFret }) {
  if (scaleIntervals.length !== 5) return [];

  const scalePcs = new Set(scaleIntervals.map((i) => mod12(rootPc + i)));
  const rootFrets = findRootFretsOnLowE(rootPc, maxFret);

  const instances = [];
  const seen = new Set();

  for (const rf of rootFrets) {
    for (let b = 0; b < 5; b++) {
      const boxStart = rf + PENTA_BOX_START_OFFSETS[b];
      if (boxStart < 0 || boxStart > maxFret) continue;
      const boxEnd = Math.min(maxFret, boxStart + 4);

      const key = `${b}@${boxStart}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const cells = new Set();

      for (let sIdx = 0; sIdx < 6; sIdx++) {
        const frets = [];
        for (let f = boxStart; f <= boxEnd; f++) {
          const pc = mod12(STRINGS[sIdx].pc + f);
          if (scalePcs.has(pc)) frets.push(f);
        }

        // Bordes: extendemos 1 traste si faltan notas
        if (frets.length < 2) {
          for (const f of [boxStart - 1, boxEnd + 1]) {
            if (f < 0 || f > maxFret) continue;
            const pc = mod12(STRINGS[sIdx].pc + f);
            if (scalePcs.has(pc)) frets.push(f);
          }
        }

        frets
          .filter((x) => x >= 0 && x <= maxFret)
          .sort((a, b) => a - b)
          .forEach((x) => cells.add(`${sIdx}:${x}`));
      }

      if (cells.size >= 10) {
        instances.push({ typeIdx: b, anchorFret: boxStart, rootFret: rf, name: `Box ${b + 1} @${boxStart}`, cells });
      }
    }
  }

  return instances;
}

function mergeInstancesToPatterns(instances, typeCount, namePrefix) {
  const patterns = Array.from({ length: typeCount }, (_, idx) => ({ idx, name: `${namePrefix} ${idx + 1}`, cells: new Set() }));
  for (const inst of instances) {
    if (inst.typeIdx == null) continue;
    if (inst.typeIdx < 0 || inst.typeIdx >= typeCount) continue;
    for (const key of inst.cells) patterns[inst.typeIdx].cells.add(key);
  }
  return patterns;
}

// ------------------------
// Ruta musical
// ------------------------

function buildPitchSequence({ rootPc, scaleIntervals, startPitch, endPitch }) {
  if (scaleIntervals.length < 2) return { pitches: [], dir: 0, error: "Escala demasiado corta" };
  if (startPitch === endPitch) return { pitches: [startPitch], dir: 0, error: "Mismo tono" };

  const dir = endPitch > startPitch ? 1 : -1;
  const idxMap = new Map(scaleIntervals.map((x, i) => [mod12(x), i]));
  const n = scaleIntervals.length;

  const startI = mod12(startPitch - rootPc);
  const endI = mod12(endPitch - rootPc);
  if (!idxMap.has(startI) || !idxMap.has(endI)) {
    return { pitches: [], dir, error: "Inicio y/o fin no están en la escala" };
  }

  const pitches = [startPitch];
  let p = startPitch;
  let guard = 0;

  while ((dir === 1 && p < endPitch) || (dir === -1 && p > endPitch)) {
    const i = mod12(p - rootPc);
    const idx = idxMap.get(i);
    if (idx === undefined) return { pitches: [], dir, error: "Ruta cayó fuera de la escala" };

    const nextIdx = (idx + (dir === 1 ? 1 : -1) + n) % n;
    const nextI = mod12(scaleIntervals[nextIdx]);

    let delta;
    if (dir === 1) delta = (nextI - i + 12) % 12;
    else delta = (i - nextI + 12) % 12;
    if (delta === 0) delta = 12;

    p = p + dir * delta;
    pitches.push(p);

    guard++;
    if (guard > 300) return { pitches: [], dir, error: "Ruta demasiado larga" };
  }

  if (p !== endPitch) return { pitches: [], dir, error: "No se puede llegar siguiendo la escala" };

  return { pitches, dir, error: null };
}

function movementCost(a, b) {
  const ds = Math.abs(a.sIdx - b.sIdx);
  const df = Math.abs(a.fret - b.fret);

  // Penaliza saltos grandes (pero deja que existan)
  const farStringPenalty = ds > 1 ? (ds - 1) * 6 : 0;
  const farFretPenalty = df > 4 ? (df - 4) * 2.0 : 0;

  // Bonus por "slide"/continuidad en la misma cuerda con saltos pequeños
  const sameStringBonus = ds === 0 ? (df <= 1 ? 0.6 : df === 2 ? 0.25 : 0) : 0;

  const base = df + 1.2 * ds + farStringPenalty + farFretPenalty - sameStringBonus;
  return Math.max(0.05, base);
}

function computeMusicalRoute({
  rootPc,
  scaleIntervals,
  maxFret,
  startPos,
  endPos,
  routeMode, // free | pattern | pos
  fixedPatternIdx,
  allowPatternSwitch,
  patternSwitchPenalty,
  maxNotesPerString,
  preferNps,
  preferVertical = false,
  patternInstances,
  instanceMembership,
  preferKeepPattern,
  // pos-mode
  positionWindowSize = 6,
  maxPositionShiftPerStep = 2,
  positionShiftPenalty = 0.7,
  // hard constraints (tocabilidad)
  maxFretJumpPerStep = 7,
  maxStringJumpPerStep = 2,
  // evitar "teletransporte" entre copias del mismo patrón
  maxInstanceShift = 4,
  // empuja a elegir la instancia cuya ancla está cerca del inicio
  initAnchorPenalty = 0.9,
}) {
  if (!startPos || !endPos) return { path: [], cost: null, reason: "Posición inválida" };
  if (startPos.fret > maxFret || endPos.fret > maxFret) return { path: [], cost: null, reason: "Aumenta trastes" };

  const startPitch = pitchAt(startPos.sIdx, startPos.fret);
  const endPitch = pitchAt(endPos.sIdx, endPos.fret);

  const seq = buildPitchSequence({ rootPc, scaleIntervals, startPitch, endPitch });
  if (seq.error) return { path: [], cost: null, reason: seq.error };
  if (seq.dir === 0) return { path: [], cost: null, reason: "No hay recorrido (mismo tono)" };

  const pitches = seq.pitches;
  const npsTarget = scaleIntervals.length === 7 ? 3 : scaleIntervals.length === 5 ? 2 : Math.min(3, maxNotesPerString);

  const windowSize = Math.max(3, Math.min(12, positionWindowSize));
  const maxPosStart = Math.max(0, maxFret - (windowSize - 1));

  function posStartsForFret(fret) {
    const lo = Math.max(0, fret - (windowSize - 1));
    const hi = Math.min(fret, maxPosStart);
    const arr = [];
    for (let ps = lo; ps <= hi; ps++) arr.push(ps);
    return arr.length ? arr : [Math.max(0, Math.min(maxPosStart, fret))];
  }

  function inWindow(posStart, fret) {
    return fret >= posStart && fret <= posStart + windowSize - 1;
  }

  function allowedInstancesForCell(cellKey) {
    if (routeMode === "free") return [0];

    // si no hay instancias, actúa como libre (pero con pos-window si aplica)
    if (!patternInstances || patternInstances.length === 0) return [0];

    const arr = (instanceMembership && instanceMembership.get(cellKey)) || [];
    if (!arr.length) return [];

    if (fixedPatternIdx == null) return arr;
    return arr.filter((instIdx) => patternInstances[instIdx].typeIdx === fixedPatternIdx);
  }

  const candidates = pitches.map((pitch, i) => {
    if (i === 0) return [{ sIdx: startPos.sIdx, fret: startPos.fret, pc: mod12(STRINGS[startPos.sIdx].pc + startPos.fret) }];
    if (i === pitches.length - 1)
      return [{ sIdx: endPos.sIdx, fret: endPos.fret, pc: mod12(STRINGS[endPos.sIdx].pc + endPos.fret) }];
    return positionsForPitch(pitch, maxFret);
  });

  const parent = new Map();
  const posByKey = new Map();

  // Estado: i|sIdx|fret|consec|instIdx|posStart
  function key(i, sIdx, fret, consec, instIdx, posStart) {
    return `${i}|${sIdx}|${fret}|${consec}|${instIdx}|${posStart}`;
  }

  function parseKey(k) {
    const [i, s, f, c, inst, ps] = k.split("|").map((x) => parseInt(x, 10));
    return { i, sIdx: s, fret: f, consec: c, instIdx: inst, posStart: ps };
  }

  function stepFeasible(prevPos, candPos) {
    const df = Math.abs(candPos.fret - prevPos.fret);
    const ds = Math.abs(candPos.sIdx - prevPos.sIdx);
    return df <= maxFretJumpPerStep && ds <= maxStringJumpPerStep;
  }

  let prev = new Map();

  const startCellKey = `${startPos.sIdx}:${startPos.fret}`;
  const startInsts = allowedInstancesForCell(startCellKey);
  if (routeMode !== "free" && startInsts.length === 0) {
    return { path: [], cost: null, reason: "El inicio no cae en ningún patrón permitido" };
  }

  const startPosStarts = routeMode === "pos" ? posStartsForFret(startPos.fret) : [0];

  for (const instIdx of startInsts.length ? startInsts : [0]) {
    for (const ps of startPosStarts) {
      if (routeMode === "pos" && !inWindow(ps, startPos.fret)) continue;
      const k = key(0, startPos.sIdx, startPos.fret, 1, instIdx, ps);
      {
      const anchor = patternInstances?.[instIdx]?.anchorFret ?? startPos.fret;
      const initCost = routeMode === "free" ? 0 : initAnchorPenalty * Math.abs(anchor - startPos.fret);
      prev.set(k, initCost);
    }
      parent.set(k, null);
      posByKey.set(k, candidates[0][0]);
    }
  }

  for (let i = 1; i < candidates.length; i++) {
    const cur = new Map();

    for (const [pk, pcost] of prev.entries()) {
      const prevInfo = parseKey(pk);
      const prevPos = posByKey.get(pk);

      // sticky instance: si hay opción dentro de la misma instancia, obligar
      let mustStayInst = false;
      let mustChangeString = false; // preferVertical: fuerza cambio de cuerda si existe opción viable
      if (preferKeepPattern && routeMode !== "free" && patternInstances && patternInstances.length) {
        for (const cand of candidates[i]) {
          const sameString = cand.sIdx === prevInfo.sIdx;
          const newConsec = sameString ? prevInfo.consec + 1 : 1;
          if (newConsec > maxNotesPerString) continue;
          if (!stepFeasible(prevPos, cand)) continue;

          const cellKey = `${cand.sIdx}:${cand.fret}`;
          const insts = allowedInstancesForCell(cellKey);
          if (insts.includes(prevInfo.instIdx)) {
            // en pos-mode también comprobar ventana
            if (routeMode === "pos") {
              const posStarts = posStartsForFret(cand.fret);
              const ok = posStarts.some((ps) => inWindow(ps, cand.fret) && Math.abs(ps - prevInfo.posStart) <= maxPositionShiftPerStep);
              if (!ok) continue;
            }
            mustStayInst = true;
            break;
          }
        }
      }

      // preferVertical: si existe una opción que cambie de cuerda (adyacente) con poco salto de traste, obligar.
      if (preferVertical) {
        for (const cand of candidates[i]) {
          const sameString = cand.sIdx === prevInfo.sIdx;
          const newConsec = sameString ? prevInfo.consec + 1 : 1;
          if (newConsec > maxNotesPerString) continue;
          if (!stepFeasible(prevPos, cand)) continue;

          const dsStep = Math.abs(cand.sIdx - prevInfo.sIdx);
          const dfStep = Math.abs(cand.fret - prevPos.fret);
          if (dsStep !== 1) continue;
          if (dfStep > 2) continue;

          const cellKey = `${cand.sIdx}:${cand.fret}`;
          const instsAll = allowedInstancesForCell(cellKey);
          if (routeMode !== "free" && instsAll.length === 0) continue;

          // Si estamos en patrón fijo, respeta la instancia actual cuando corresponda
          if (routeMode !== "free") {
            if (mustStayInst) {
              if (!instsAll.includes(prevInfo.instIdx)) continue;
            }
          }

          // pos-mode: respeta ventana
          if (routeMode === "pos") {
            const posStarts = posStartsForFret(cand.fret);
            const ok = posStarts.some((ps) => inWindow(ps, cand.fret) && Math.abs(ps - prevInfo.posStart) <= maxPositionShiftPerStep);
            if (!ok) continue;
          }

          mustChangeString = true;
          break;
        }
      }

      for (const cand of candidates[i]) {
        const sameString = cand.sIdx === prevInfo.sIdx;
        if (mustChangeString && sameString) continue;
        const newConsec = sameString ? prevInfo.consec + 1 : 1;
        if (newConsec > maxNotesPerString) continue;
        if (!stepFeasible(prevPos, cand)) continue;

        const cellKey = `${cand.sIdx}:${cand.fret}`;
        const instsAll = allowedInstancesForCell(cellKey);
        if (routeMode !== "free" && instsAll.length === 0) continue;

        const insts = mustStayInst ? instsAll.filter((x) => x === prevInfo.instIdx) : instsAll;
        if (mustStayInst && insts.length === 0) continue;

        const baseMove = movementCost(prevPos, cand);
        // Si quieres ruta "vertical" (cambiar cuerda) no penalizamos cambios de cuerda por NPS.
        const npsPenalty = preferNps && !preferVertical && !sameString && prevInfo.consec < npsTarget ? 2.2 : 0;

        // Preferir verticalidad: penaliza quedarse en la misma cuerda, premia cambio de cuerda cercano.
        const dsStep = Math.abs(cand.sIdx - prevInfo.sIdx);
        const dfStep = Math.abs(cand.fret - prevInfo.fret);
        const verticalPenalty = preferVertical && dsStep === 0 && dfStep > 0 ? 1.4 : 0;
        const verticalBonus = preferVertical && dsStep === 1 && dfStep <= 1 ? 0.35 : 0;

        const posStartCandidates = routeMode === "pos" ? posStartsForFret(cand.fret) : [prevInfo.posStart];

        for (const psNew of posStartCandidates) {
          if (routeMode === "pos") {
            if (!inWindow(psNew, cand.fret)) continue;
            const shift = Math.abs(psNew - prevInfo.posStart);
            if (shift > maxPositionShiftPerStep) continue;
          }

          const posCost = routeMode === "pos" ? Math.abs(psNew - prevInfo.posStart) * positionShiftPenalty : 0;

          for (const instIdx of insts.length ? insts : [0]) {
            if (!allowPatternSwitch && routeMode !== "free" && instIdx !== prevInfo.instIdx) continue;

            let switchPenalty = 0;
            if (routeMode !== "free" && instIdx !== prevInfo.instIdx) {
              const aPrev = patternInstances?.[prevInfo.instIdx]?.anchorFret ?? prevInfo.fret;
              const aNew = patternInstances?.[instIdx]?.anchorFret ?? cand.fret;
              const typePrev = patternInstances?.[prevInfo.instIdx]?.typeIdx ?? -1;
              const typeNew = patternInstances?.[instIdx]?.typeIdx ?? -1;
              {
              const anchorDiff = Math.abs(aNew - aPrev);
              if (anchorDiff > maxInstanceShift) continue;
              switchPenalty = patternSwitchPenalty + 0.7 * anchorDiff + (typePrev !== typeNew ? 1.6 : 0);
            }
            }

            const nk = key(i, cand.sIdx, cand.fret, newConsec, instIdx, psNew);
            const cost = pcost + baseMove + npsPenalty + switchPenalty + posCost + verticalPenalty - verticalBonus;

            if (!cur.has(nk) || cost < cur.get(nk)) {
              cur.set(nk, cost);
              parent.set(nk, pk);
              posByKey.set(nk, cand);
            }
          }
        }
      }
    }

    if (!cur.size) return { path: [], cost: null, reason: "No encontré ruta con estos límites/patrones" };
    prev = cur;
  }

  let bestKey = null;
  let bestCost = Infinity;

  for (const [k, c] of prev.entries()) {
    const info = parseKey(k);
    if (info.sIdx === endPos.sIdx && info.fret === endPos.fret) {
      if (c < bestCost) {
        bestCost = c;
        bestKey = k;
      }
    }
  }

  if (!bestKey) return { path: [], cost: null, reason: "No pude terminar exactamente en el destino" };

  const path = [];
  let k = bestKey;
  while (k) {
    path.push(posByKey.get(k));
    k = parent.get(k);
  }
  path.reverse();

  return { path, cost: bestCost, reason: null };
}

export default function FretboardScalesPage() {
  // Notación (auto / override)
  const [accMode, setAccMode] = useState("auto"); // auto | sharps | flats
  // Vista (pueden coexistir)
  const [showIntervalsLabel, setShowIntervalsLabel] = useState(true);
  const [showNotesLabel, setShowNotesLabel] = useState(false);

  const [rootPc, setRootPc] = useState(5); // F
  const [scaleName, setScaleName] = useState("Escala mayor");
  const isPentatonicScale = scaleName === "Pentatónica mayor" || scaleName === "Pentatónica menor";
  const [maxFret, setMaxFret] = useState(15);

  const [showNonScale, setShowNonScale] = useState(false);

  const [customInput, setCustomInput] = useState("1 3 5 7");

  // Extras (default OFF)
  const [extraInput, setExtraInput] = useState("b2");
  const [showExtra, setShowExtra] = useState(false);

  // Qué mástiles mostrar
  const [showBoards, setShowBoards] = useState({ scale: true, patterns: true, route: true });

  // Ruta
  const [routeStartCode, setRouteStartCode] = useState("61");
  const [routeEndCode, setRouteEndCode] = useState("113");
  const [routeMaxPerString, setRouteMaxPerString] = useState(4);
  const [routeMode, setRouteMode] = useState("auto"); // auto | free | penta | nps | pos
  const [routePreferNps, setRoutePreferNps] = useState(true);
  const [routePreferVertical, setRoutePreferVertical] = useState(false);
  const [routeKeepPattern, setRouteKeepPattern] = useState(false);
  const [allowPatternSwitch, setAllowPatternSwitch] = useState(true);
  const [patternSwitchPenalty, setPatternSwitchPenalty] = useState(2.0);
  const [routeFixedPattern, setRouteFixedPattern] = useState("auto");
  const [routePickNext, setRoutePickNext] = useState("start"); // start | end

  // Colores
  const [colors, setColors] = useState({
    root: "#e11d48",
    third: "#0284c7",
    fifth: "#059669",
    other: "#e2e8f0",
    extra: "#f59e0b",
    route: "#a78bfa",
  });

  const [patternColors, setPatternColors] = useState([
    "#c7d2fe",
    "#bae6fd",
    "#bbf7d0",
    "#fde68a",
    "#fecaca",
    "#ddd6fe",
    "#a7f3d0",
  ]);

  const scaleIntervals = useMemo(() => buildScaleIntervals(scaleName, customInput, rootPc), [scaleName, customInput, rootPc]);

  // Ajuste lógico de modos según la escala elegida
  useEffect(() => {
    if (isPentatonicScale && routeMode === "nps") setRouteMode("auto");
    if (!isPentatonicScale && routeMode === "penta") setRouteMode("auto");
    if (!isPentatonicScale && scaleIntervals.length !== 7 && routeMode === "nps") setRouteMode("auto");
  }, [isPentatonicScale, scaleIntervals.length, routeMode]);
  const scalePcs = useMemo(() => new Set(scaleIntervals.map((i) => mod12(rootPc + i))), [scaleIntervals, rootPc]);

  const thirdOffsets = useMemo(() => pickThirdOffsets(scaleIntervals), [scaleIntervals]);
  const hasFifth = useMemo(() => new Set(scaleIntervals.map(mod12)).has(7), [scaleIntervals]);

  const extraIntervals = useMemo(() => parseTokensToIntervals({ input: extraInput, rootPc }), [extraInput, rootPc]);
  const extraPcs = useMemo(() => new Set(extraIntervals.map((i) => mod12(rootPc + i))), [extraIntervals, rootPc]);

  const autoPreferSharps = useMemo(() => computeAutoPreferSharps({ rootPc, scaleName }), [rootPc, scaleName]);
  const preferSharps = accMode === "auto" ? autoPreferSharps : accMode === "sharps";

  const noteOptions = useMemo(() => {
    const list = preferSharps ? NOTES_SHARP : NOTES_FLAT;
    return list.map((n, i) => ({ label: n, pc: i }));
  }, [preferSharps]);

  const spelledScaleNotes = useMemo(() => spellScaleNotes({ rootPc, scaleIntervals, preferSharps }), [rootPc, scaleIntervals, preferSharps]);
  const spelledExtraNotes = useMemo(() => spellScaleNotes({ rootPc, scaleIntervals: extraIntervals, preferSharps }), [rootPc, extraIntervals, preferSharps]);

  const legend = useMemo(() => {
    const thirds = thirdOffsets.map((o) => (o === 3 ? "m3" : "M3")).join(" / ");
    return {
      root: "Raíz (1)",
      third: thirdOffsets.length ? `3ª (${thirds})` : "3ª (no está)",
      fifth: hasFifth ? "5ª (P5)" : "5ª (no está)",
      other: "Otras notas de la escala",
      extra: "Notas extra",
    };
  }, [thirdOffsets, hasFifth]);

  function roleOfPc(pc) {
    const interval = mod12(pc - rootPc);
    if (interval === 0) return "root";
    if (thirdOffsets.includes(interval)) return "third";
    if (interval === 7) return "fifth";
    return "other";
  }

  function circleStyle(role) {
    const bg = colors[role] || "#e2e8f0";
    const dark = isDark(bg);
    return {
      backgroundColor: bg,
      color: role === "other" ? "#0f172a" : dark ? "#ffffff" : "#0f172a",
      boxShadow: `0 0 0 2px ${rgba(bg, 0.25)}`,
    };
  }

  function getDisplayRole({ pc, inScale, inExtra }) {
    const role = roleOfPc(pc);
    if (role !== "other") return role;
    if (inExtra) return "extra";
    if (inScale) return "other";
    return null;
  }

  function labelForPc(pc) {
    const interval = mod12(pc - rootPc);
    const itv = intervalToDegreeToken(interval);
    const note = pcToName(pc, preferSharps);

    const showI = !!showIntervalsLabel;
    const showN = !!showNotesLabel;

    if (!showI && !showN) return itv;
    if (showI && showN) return `${itv}-${note}`;
    if (showI) return itv;
    return note;
  }

  function setColor(key, value) {
    setColors((c) => ({ ...c, [key]: value }));
  }

  function setPatternColor(i, value) {
    setPatternColors((arr) => {
      const next = [...arr];
      next[i] = value;
      return next;
    });
  }

  // Patrones (para el 2º mástil)
  const patternsMerged = useMemo(() => {
    if (isPentatonicScale && scaleIntervals.length === 5) {
      const inst = buildPentatonicBoxInstances({ rootPc, scaleIntervals, maxFret });
      return mergeInstancesToPatterns(inst, 5, "Box");
    }
    if (!isPentatonicScale && scaleIntervals.length === 7) {
      return build3NpsPatternsMerged({ rootPc, scaleIntervals, maxFret });
    }
    return [];
  }, [isPentatonicScale, rootPc, scaleIntervals, maxFret]);

  const patternMembership = useMemo(() => buildMembershipMap(patternsMerged), [patternsMerged]);

  function patternBgStyle(cellKey) {
    const idxs = patternMembership.get(cellKey) || [];
    if (!idxs.length) return {};
    const a = idxs[0];
    const b = idxs[1];
    if (b == null) {
      const c = patternColors[a] || "#e2e8f0";
      return { backgroundColor: rgba(c, 0.65) };
    }
    const c1 = rgba(patternColors[a] || "#e2e8f0", 0.65);
    const c2 = rgba(patternColors[b] || "#e2e8f0", 0.65);
    return { backgroundImage: `linear-gradient(135deg, ${c1} 0%, ${c1} 50%, ${c2} 50%, ${c2} 100%)` };
  }

  // Ruta
  const startPos = useMemo(() => parsePosCode(routeStartCode), [routeStartCode]);
  const endPos = useMemo(() => parsePosCode(routeEndCode), [routeEndCode]);

  const fixedPatternIdx = useMemo(() => {
    if (routeFixedPattern === "auto") return null;
    const n = parseInt(routeFixedPattern, 10);
    return Number.isFinite(n) ? n : null;
  }, [routeFixedPattern]);

  // Instancias para ruta (separamos pentatónicas de 7 notas)
  const pentaBoxInstances = useMemo(() => {
    if (!isPentatonicScale || scaleIntervals.length !== 5) return [];
    return buildPentatonicBoxInstances({ rootPc, scaleIntervals, maxFret });
  }, [isPentatonicScale, rootPc, scaleIntervals, maxFret]);

  const pentaBoxMembership = useMemo(() => buildInstanceMembershipMap(pentaBoxInstances), [pentaBoxInstances]);

  const npsInstances = useMemo(() => {
    if (isPentatonicScale || scaleIntervals.length !== 7) return [];
    return build3NpsPatternInstances({ rootPc, scaleIntervals, maxFret });
  }, [isPentatonicScale, rootPc, scaleIntervals, maxFret]);

  const npsMembership = useMemo(() => buildInstanceMembershipMap(npsInstances), [npsInstances]);

  const routeResult = useMemo(() => {
    const modePenalty = (m) => (m === "penta" || m === "nps" ? 0 : m === "pos" ? 2.0 : 4.0);

    const runMode = (m, keepOverride = null) => {
      const keep = keepOverride == null ? routeKeepPattern : keepOverride;

      let internalMode = "free";
      let instances = [];
      let membership = new Map();
      let typeFilter = null;

      if (m === "penta" && isPentatonicScale && scaleIntervals.length === 5) {
        internalMode = "pattern";
        instances = pentaBoxInstances;
        membership = pentaBoxMembership;
        typeFilter = fixedPatternIdx;
      } else if (m === "nps" && !isPentatonicScale && scaleIntervals.length === 7) {
        internalMode = "pattern";
        instances = npsInstances;
        membership = npsMembership;
        typeFilter = fixedPatternIdx;
      } else if (m === "pos") {
        internalMode = "pos";
      } else {
        internalMode = "free";
      }

      const args = {
        rootPc,
        scaleIntervals,
        maxFret,
        startPos,
        endPos,
        routeMode: internalMode,
        fixedPatternIdx: typeFilter,
        allowPatternSwitch,
        patternSwitchPenalty,
        maxNotesPerString: Math.max(1, Math.min(5, routeMaxPerString)),
        preferNps: routePreferNps,
        preferVertical: routePreferVertical,
        patternInstances: instances,
        instanceMembership: membership,
        preferKeepPattern: keep,
        positionWindowSize: 6,
        maxPositionShiftPerStep: 2,
        positionShiftPenalty: 0.7,
        maxFretJumpPerStep: internalMode === "pattern" ? 5 : internalMode === "pos" ? 6 : 7,
        maxStringJumpPerStep: internalMode === "pattern" ? 1 : 2,
        maxInstanceShift: internalMode === "pattern" ? 3 : 99,
        initAnchorPenalty: internalMode === "pattern" ? 0.8 : 0,
      };

      const res = computeMusicalRoute(args);
      if (res.reason) return { res, score: Infinity };
      return { res, score: (res.cost ?? 0) + modePenalty(m) };
    };

    const pickBest = (modes) => {
      let best = { res: { path: [], cost: null, reason: "No encontré ruta" }, score: Infinity };
      for (const m of modes) {
        let a = runMode(m, null);
        if (!Number.isFinite(a.score) && routeKeepPattern) a = runMode(m, false);
        if (a.score < best.score) best = a;
      }
      return best.res;
    };

    if (routeMode === "auto") {
      if (isPentatonicScale) return pickBest(["penta", "pos", "free"]);
      if (scaleIntervals.length === 7) return pickBest(["nps", "pos", "free"]);
      return pickBest(["pos", "free"]);
    }

    // Manual
    if (routeMode === "penta" && isPentatonicScale) return pickBest(["penta"]);
    if (routeMode === "nps" && !isPentatonicScale && scaleIntervals.length === 7) return pickBest(["nps"]);
    if (routeMode === "pos") return pickBest(["pos"]);
    return pickBest(["free"]);
  }, [
    rootPc,
    scaleIntervals,
    maxFret,
    startPos,
    endPos,
    routeMode,
    isPentatonicScale,
    routeKeepPattern,
    fixedPatternIdx,
    allowPatternSwitch,
    patternSwitchPenalty,
    routeMaxPerString,
    routePreferNps,
    routePreferVertical,
    pentaBoxInstances,
    pentaBoxMembership,
    npsInstances,
    npsMembership,
  ]);

  const routeIndexByCell = useMemo(() => {
    const m = new Map();
    routeResult.path.forEach((n, i) => m.set(`${n.sIdx}:${n.fret}`, i + 1));
    return m;
  }, [routeResult.path]);

  function Circle({ pc, role, fret, sIdx, badge }) {
    const baseRole = role === "extra" ? "extra" : role;
    return (
      <div
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold"
        style={circleStyle(baseRole)}
        title={`${pcToName(pc, preferSharps)} | ${intervalToDegreeToken(mod12(pc - rootPc))} | cuerda ${sIdx + 1}, traste ${fret}`}
      >
        {labelForPc(pc)}
        {badge ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] text-white">
            {badge}
          </span>
        ) : null}
      </div>
    );
  }

  function Fretboard({ title, subtitle, mode }) {
    // mode: scale | patterns | route
    const showAllNotes = showNonScale && mode === "scale";

    return (
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-800">{title}</div>
            {subtitle ? <div className="text-xs text-slate-600">{subtitle}</div> : null}
          </div>

          {mode === "route" ? (
            <div className="text-xs text-slate-600">
              {routeResult.reason ? (
                <span className="font-semibold text-rose-600">{routeResult.reason}</span>
              ) : (
                <span>
                  Ruta: {routeStartCode} → {routeEndCode} | pasos: <b>{routeResult.path.length}</b>
                </span>
              )}
            </div>
          ) : null}
        </div>

        <div
          className="grid items-center gap-1"
          style={{ gridTemplateColumns: `110px repeat(${maxFret + 1}, minmax(36px, 1fr))` }}
        >
          <div className="text-xs font-semibold text-slate-600">Cuerda</div>
          {Array.from({ length: maxFret + 1 }, (_, fret) => (
            <div key={fret} className="relative flex flex-col items-center">
              <div className="text-[10px] text-slate-600">{fret}</div>
              {FRET_MARKERS.has(fret) && <div className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-300" />}
            </div>
          ))}
        </div>

        <div className="mt-2 space-y-1">
          {STRINGS.map((st, sIdx) => (
            <div
              key={st.label}
              className="grid items-center gap-1"
              style={{ gridTemplateColumns: `110px repeat(${maxFret + 1}, minmax(36px, 1fr))` }}
            >
              <div className="text-xs font-medium text-slate-700">{st.label}</div>

              {Array.from({ length: maxFret + 1 }, (_, fret) => {
                const pc = mod12(st.pc + fret);
                const inScale = scalePcs.has(pc);
                const inExtra = showExtra && extraPcs.has(pc);
                const displayRole = getDisplayRole({ pc, inScale, inExtra });

                const cellKey = `${sIdx}:${fret}`;
                const bgPat = mode === "patterns" && inScale ? patternBgStyle(cellKey) : {};

                const routeIdx = mode === "route" ? routeIndexByCell.get(cellKey) : null;
                const inRoute = mode === "route" && routeIdx != null;
                const bgRoute = inRoute
                  ? {
                      backgroundImage: `linear-gradient(0deg, ${rgba(colors.route, 0.28)} 0%, ${rgba(colors.route, 0.28)} 100%)`,
                      boxShadow: `inset 0 0 0 2px ${rgba(colors.route, 0.9)}`,
                    }
                  : {};

                const shouldRender = displayRole !== null || showAllNotes;

                return (
                  <div
                    key={`${sIdx}-${fret}`}
                    onClick={() => {
                      // Selección rápida de inicio/fin SOLO en el mástil de ruta y sobre notas de la escala.
                      if (mode !== "route") return;
                      if (!inScale) return;
                      const code = `${sIdx + 1}${fret}`;
                      if (routePickNext === "start") {
                        setRouteStartCode(code);
                        setRoutePickNext("end");
                      } else {
                        setRouteEndCode(code);
                        setRoutePickNext("start");
                      }
                    }}
                    className={`flex h-10 items-center justify-center rounded-lg border ${
                      fret === 0 ? "border-slate-300" : "border-slate-200"
                    } ${mode === "route" && inScale ? "cursor-pointer hover:ring-2 hover:ring-slate-300" : ""}`}
                    style={{ backgroundColor: "#f8fafc", ...bgPat, ...bgRoute }}
                  >
                    {shouldRender && displayRole ? (
                      <Circle pc={pc} role={displayRole} fret={fret} sIdx={sIdx} badge={mode === "route" ? routeIdx : null} />
                    ) : showAllNotes ? (
                      <div className="text-[11px] text-slate-400">{labelForPc(pc)}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1 text-xs text-slate-600">
          <div>
            Escala activa ({pcToName(rootPc, preferSharps)}): {scaleIntervals.map((i) => intervalToDegreeToken(i)).join(" – ")}
          </div>
          <div>
            Escala activa ({pcToName(rootPc, preferSharps)}): {spelledScaleNotes.join(" – ")}
          </div>

          {showExtra ? (
            <>
              <div>
                Extra ({pcToName(rootPc, preferSharps)}): {extraIntervals.map((i) => intervalToDegreeToken(i)).join(" – ")}
              </div>
              <div>
                Extra ({pcToName(rootPc, preferSharps)}): {spelledExtraNotes.join(" – ")}
              </div>
            </>
          ) : null}
        </div>
      </section>
    );
  }

  function ToggleButton({ active, onClick, children }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-xl px-3 py-2 text-sm ring-1 ring-slate-200 shadow-sm ${active ? "bg-slate-900 text-white" : "bg-white"}`}
      >
        {children}
      </button>
    );
  }

  const wrap = "mx-auto max-w-[1500px] p-4";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <div className={wrap}>
        <header className="mb-4">
          <h1 className="text-2xl font-semibold">Mástil interactivo: escalas, patrones y rutas</h1>
          <p className="text-sm text-slate-600">
            Patrones: <b>5 boxes</b> (pentatónicas) y <b>7 3NPS</b> (escalas de 7 notas). Ruta: sigue la escala en orden y se restringe a patrones.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          {/* IZQUIERDA */}
          <div className="space-y-4">
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="grid gap-3 md:grid-cols-12 items-start">
                {/* Base */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium">Nota raíz</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={rootPc}
                    onChange={(e) => setRootPc(parseInt(e.target.value, 10))}
                  >
                    {noteOptions.map((o) => (
                      <option key={o.pc} value={o.pc}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-5">
                  <label className="block text-sm font-medium">Escala</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={scaleName}
                    onChange={(e) => setScaleName(e.target.value)}
                  >
                    {Object.keys(SCALE_PRESETS).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                {scaleName === "Personalizada" ? (
                  <div className="md:col-span-12">
                    <label className="block text-sm font-medium">Intervalos (escala personalizada)</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Ej: 1,b3,5,6 (semitonos: s0 s3 s7 s9; o notas: F Ab C D)"
                    />
                    <div className="mt-1 text-[11px] text-slate-500">
                      Admite grados (b3, #4), semitonos (s0–s11) o notas. La raíz siempre se añade.
                    </div>
                  </div>
                ) : null}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Trastes</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={maxFret}
                    onChange={(e) => setMaxFret(parseInt(e.target.value, 10))}
                  >
                    {[12, 15, 17, 19, 21, 24].map((n) => (
                      <option key={n} value={n}>
                        0–{n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Vista</label>
                  <div className="mt-2 flex gap-2">
                    <ToggleButton active={showNotesLabel} onClick={() => setShowNotesLabel((v) => !v)}>
                      Notas
                    </ToggleButton>
                    <ToggleButton active={showIntervalsLabel} onClick={() => setShowIntervalsLabel((v) => !v)}>
                      Intervalos
                    </ToggleButton>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">Si activas ambas: 1-F dentro del círculo.</div>
                </div>

                {/* Opciones */}
                <div className="md:col-span-4">
                  <label className="block text-sm font-medium">Notación</label>
                  <div className="mt-2 flex gap-2">
                    <ToggleButton active={accMode === "auto"} onClick={() => setAccMode("auto")}>
                      Auto
                    </ToggleButton>
                    <ToggleButton active={accMode !== "auto" && preferSharps} onClick={() => setAccMode("sharps")}>
                      #
                    </ToggleButton>
                    <ToggleButton active={accMode !== "auto" && !preferSharps} onClick={() => setAccMode("flats")}>
                      b
                    </ToggleButton>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Auto usa la armadura esperada (ej. F mayor ⇒ Bb, no A#).
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm font-medium">Mostrar</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ToggleButton active={showNonScale} onClick={() => setShowNonScale((v) => !v)}>
                      {showNonScale ? "Ver solo escala" : "Ver todo"}
                    </ToggleButton>
                    <ToggleButton active={showExtra} onClick={() => setShowExtra((v) => !v)}>
                      {showExtra ? "Extra ON" : "Extra OFF"}
                    </ToggleButton>
                  </div>
                </div>

                <div className="md:col-span-5">
                  <label className="block text-sm font-medium">Notas extra</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={extraInput}
                    onChange={(e) => setExtraInput(e.target.value)}
                    placeholder="Ej: b2 6 (o: C# F)"
                  />
                </div>

                {/* Ruta */}
                <div className="md:col-span-12">
                  <div className="mt-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-800">Ruta musical</div>
                      <div className="text-xs text-slate-600">
                        Click en el mástil de ruta para elegir: <b>{routePickNext === "start" ? "Inicio" : "Fin"}</b>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-12 items-end">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700">Inicio</label>
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                          value={routeStartCode}
                          onChange={(e) => setRouteStartCode(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700">Fin</label>
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                          value={routeEndCode}
                          onChange={(e) => setRouteEndCode(e.target.value)}
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-slate-700">Máx. notas seguidas/cuerda</label>
                        <select
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                          value={routeMaxPerString}
                          onChange={(e) => setRouteMaxPerString(parseInt(e.target.value, 10))}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-slate-700">Modo ruta</label>
                        <select
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                          value={routeMode}
                          onChange={(e) => setRouteMode(e.target.value)}
                        >
                          <option value="auto">Auto</option>
                          {isPentatonicScale ? <option value="penta">Pentatónica (boxes)</option> : null}
                          {!isPentatonicScale && scaleIntervals.length === 7 ? <option value="nps">3NPS</option> : null}
                          <option value="pos">Posición/diagonal (slide)</option>
                          <option value="free">Libre</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700">Patrón</label>
                        <select
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                          value={routeFixedPattern}
                          disabled={!((routeMode === "penta" && isPentatonicScale) || (routeMode === "nps" && !isPentatonicScale && scaleIntervals.length === 7))}
                          onChange={(e) => setRouteFixedPattern(e.target.value)}
                        >
                          <option value="auto">Auto</option>
                          {routeMode === "penta" && isPentatonicScale
                            ? [0, 1, 2, 3, 4].map((i) => (
                                <option key={i} value={String(i)}>
                                  Box {i + 1}
                                </option>
                              ))
                            : routeMode === "nps" && !isPentatonicScale && scaleIntervals.length === 7
                              ? [0, 1, 2, 3, 4, 5, 6].map((i) => (
                                  <option key={i} value={String(i)}>
                                    3NPS {i + 1}
                                  </option>
                                ))
                              : null}
                        </select>
                      </div>

                      <div className="md:col-span-12">
                        <div className="mt-2 flex flex-wrap gap-2">
                          <ToggleButton active={routePreferNps} onClick={() => setRoutePreferNps((v) => !v)}>
                            Preferir NPS
                          </ToggleButton>
                          <ToggleButton
                            active={routePreferVertical}
                            onClick={() => setRoutePreferVertical((v) => !v)}
                            title="Prioriza cambiar de cuerda (vertical) frente a moverse por trastes"
                          >
                            Preferir vertical
                          </ToggleButton>
                          <ToggleButton
                            active={routeKeepPattern}
                            onClick={() => setRouteKeepPattern((v) => !v)}
                            title="Si existe una opción dentro del patrón actual, obliga a quedarse en él"
                          >
                            Mantener patrón
                          </ToggleButton>
                          <ToggleButton active={allowPatternSwitch} onClick={() => setAllowPatternSwitch((v) => !v)}>
                            {allowPatternSwitch ? "Permite cambio patrón" : "Sin cambio patrón"}
                          </ToggleButton>

                          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                            <span className="text-slate-700">Coste cambio</span>
                            <input
                              type="range"
                              min={0}
                              max={8}
                              step={0.5}
                              value={patternSwitchPenalty}
                              onChange={(e) => setPatternSwitchPenalty(parseFloat(e.target.value))}
                            />
                            <span className="w-10 text-right tabular-nums">{patternSwitchPenalty.toFixed(1)}</span>
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-slate-600">
                          Recorrido escalar en orden (asc/desc) + restricción por patrón + coste de cambios.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toggles mástiles */}
                <div className="md:col-span-12">
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">Mástiles:</span>
                    <ToggleButton
                      active={showBoards.scale}
                      onClick={() => setShowBoards((v) => ({ ...v, scale: !v.scale }))}
                    >
                      Escala
                    </ToggleButton>
                    <ToggleButton
                      active={showBoards.patterns}
                      onClick={() => setShowBoards((v) => ({ ...v, patterns: !v.patterns }))}
                    >
                      Patrones
                    </ToggleButton>
                    <ToggleButton
                      active={showBoards.route}
                      onClick={() => setShowBoards((v) => ({ ...v, route: !v.route }))}
                    >
                      Ruta
                    </ToggleButton>
                  </div>
                </div>
              </div>
            </section>

            <div className="space-y-4">
              {showBoards.scale ? (
                <Fretboard title="Mástil" subtitle="Escala + (opcional) extras. Resalta raíz/3ª/5ª." mode="scale" />
              ) : null}

              {showBoards.patterns ? (
                <Fretboard
                  title="Patrones"
                  subtitle="Pentatónicas: 5 boxes. Escalas 7 notas: 7 3NPS. Fondo indica patrón."
                  mode="patterns"
                />
              ) : null}

              {showBoards.route ? (
                <Fretboard title="Ruta" subtitle="Ruta musical restringida a patrones (o libre)." mode="route" />
              ) : null}
            </div>
          </div>

          {/* DERECHA: COLORES */}
          <aside className="space-y-4">
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="mb-2 text-sm font-semibold text-slate-800">Colores (círculos)</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { k: "root", label: legend.root },
                  { k: "third", label: legend.third },
                  { k: "fifth", label: legend.fifth },
                  { k: "other", label: legend.other },
                  { k: "extra", label: legend.extra },
                  { k: "route", label: "Ruta (fondo)" },
                ].map((it) => (
                  <div key={it.k} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-700">{it.label}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{colors[it.k]}</div>
                    </div>
                    <input
                      type="color"
                      value={colors[it.k]}
                      onChange={(e) => setColor(it.k, e.target.value)}
                      className="h-9 w-10 cursor-pointer rounded-md border border-slate-200 bg-white"
                      title={it.label}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="mb-2 text-sm font-semibold text-slate-800">Colores (patrones)</div>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 7 }, (_, i) => i).map((i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-700">Patrón {i + 1}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{patternColors[i]}</div>
                    </div>
                    <input
                      type="color"
                      value={patternColors[i]}
                      onChange={(e) => setPatternColor(i, e.target.value)}
                      className="h-9 w-10 cursor-pointer rounded-md border border-slate-200 bg-white"
                      title={`Patrón ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                Patrones disponibles: {scaleIntervals.length === 5 ? "5 boxes" : scaleIntervals.length === 7 ? "7 3NPS" : "(sin patrones)"}.
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-800">Diagnóstico rápido</div>
              <div className="mt-2 text-xs text-slate-600">
                Si ves A# en F mayor, pon <b>Notación: Auto</b> o <b>b</b>.
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
