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

  // Menores “armónicas / melódicas”
  "Menor armónica": [0, 2, 3, 5, 7, 8, 11],
  "Menor melódica (asc)": [0, 2, 3, 5, 7, 9, 11],

  // Variantes mayores
  "Mayor armónica": [0, 2, 4, 5, 7, 8, 11],
  "Doble armónica (Bizantina)": [0, 1, 4, 5, 7, 8, 11],

  // Modos/colores habituales
  "Frigia dominante": [0, 1, 4, 5, 7, 8, 10],
  "Lidia dominante": [0, 2, 4, 6, 7, 9, 10],
  "Alterada (Superlocria)": [0, 1, 3, 4, 6, 8, 10],
  "Húngara menor (Gypsy)": [0, 2, 3, 6, 7, 8, 11],

  // Bebop (8 notas)
  "Bebop mayor": [0, 2, 4, 5, 7, 8, 9, 11],
  "Bebop dominante": [0, 2, 4, 5, 7, 9, 10, 11],
  "Bebop dórica": [0, 2, 3, 4, 5, 7, 9, 10],

  // Otras útiles
  "Blues (menor)": [0, 3, 5, 6, 7, 10],
  "Blues (mayor)": [0, 2, 3, 4, 7, 9],
  "Tonos enteros": [0, 2, 4, 6, 8, 10],
  "Disminuida (H-W)": [0, 1, 3, 4, 6, 7, 9, 10],
  "Disminuida (W-H)": [0, 2, 3, 5, 6, 8, 9, 11],

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

// Inlays tipo guitarra: puntos en 3/5/7/9 (y 15/17/19/21) y doble en 12/24.
const INLAY_SINGLE = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const INLAY_DOUBLE = new Set([12, 24]);

// Helper: columnas del grid con traste 0 más estrecho
function fretGridCols(maxFret) {
  const fret0 = "22px"; // medio/estrecho
  const rest = "minmax(36px, 1fr)";
  return `110px ${fret0} repeat(${maxFret}, ${rest})`;
}

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

// ------------------------
// Acordes
// ------------------------

// Dataset de digitaciones (voicings) para NO inventar acordes:
// https://github.com/szaza/guitar-chords-db-json (MIT)
// Nota: las carpetas del dataset van por notas con sostenidos (C#, D#, F#, G#, A#), no bemoles.
function chordDbKeyNameFromPc(pc) {
  return NOTES_SHARP[mod12(pc)];
}

function chordSuffixFromUI({ quality, structure, ext7, ext9, ext11, ext13 }) {
  // triadas
  if (structure === "triad") {
    if (quality === "maj") return "major";
    if (quality === "min") return "minor";
    // dim y semi-dim (triada) => dim
    return "dim";
  }

  // cuatriadas
  if (structure === "tetrad") {
    if (quality === "maj") return "maj7";
    if (quality === "min") return "m7";
    if (quality === "hdim") return "m7b5";
    return "dim7";
  }

  // acordes (con extensiones)
  if (quality === "hdim") return "m7b5";

  if (quality === "dim") {
    // si el usuario pide extensiones, en dim usamos dim7 (lo disponible en dataset)
    if (ext13 || ext11 || ext9 || ext7) return "dim7";
    return "dim";
  }

  if (ext13) return quality === "maj" ? "maj13" : "m13";
  if (ext11) return quality === "maj" ? "maj11" : "m11";
  if (ext9) {
    if (quality === "maj") return ext7 ? "maj9" : "add9";
    // Nota: en este dataset no hay madd9 (sin 7). Si quieres 9 en menor, marca 7 (m9).
    return ext7 ? "m9" : null;
  }

  if (ext7) return quality === "maj" ? "maj7" : "m7";
  return quality === "maj" ? "major" : "minor";
}

// Base del sitio (Vite) para que fetch a /public funcione en localhost y GitHub Pages.
// En producción (Pages) suele ser "/mastil_escalas/" y en dev "/".
// OJO: nunca accedas a import.meta.env.BASE_URL sin optional chaining.
// En Vite existe import.meta.env.BASE_URL ("/" en dev, "/<repo>/" en GitHub Pages).
// Evitamos sintaxis TS "as any" porque puede romper el parser en algunos entornos.
const APP_BASE = (import.meta && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : "/";

function chordDbUrl(keyName, suffix) {
  // Ruta RELATIVA dentro de /public (sin base) => chords-db/...
  const folder = encodeURIComponent(keyName); // A# => A%23
  const file = encodeURIComponent(`${suffix}.json`);
  return `chords-db/${folder}/${file}`;
}

function chordDbUrlLocal(keyName, suffix) {
  // Ruta para fetch respetando base (Pages)
  const base = String(APP_BASE || "/");
  const b = base.endsWith("/") ? base : base + "/";
  return `${b}${chordDbUrl(keyName, suffix)}`;
}

function publicRelToLocal(rel) {
  const base = String(APP_BASE || "/");
  const b = base.endsWith("/") ? base : base + "/";
  const r = String(rel || "").replace(/^\/+/, "");
  return `${b}${r}`;
}

function decodeChordDbFretChar(ch) {
  const c = String(ch || "").toLowerCase();
  if (!c) return null;
  if (c === "x") return null;
  const n = parseInt(c, 36); // 0-9,a-z
  return Number.isFinite(n) ? n : null;
}

function parseChordDbFretsString(frets) {
  const s = String(frets || "").trim();
  if (s.length !== 6) return null;
  const out = [];
  for (let i = 0; i < 6; i++) out.push(decodeChordDbFretChar(s[i]));
  return out;
}

function encodeChordDbFretChar(n) {
  if (n == null) return "x";
  if (n < 0) return "x";
  return n.toString(36);
}

function fretsToChordDbString(fretsLH) {
  // LowE..HighE, 6 chars
  return fretsLH.map(encodeChordDbFretChar).join("");
}

function fretsForPcOnString(sIdx, targetPc, maxFret) {
  const out = [];
  const base = STRINGS[sIdx].pc;
  for (let f = 0; f <= maxFret; f++) {
    if (mod12(base + f) === mod12(targetPc)) out.push(f);
  }
  return out;
}

function buildVoicingFromFretsLH({ fretsLH, rootPc, maxFret }) {
  // Dataset: LowE..HighE. UI uses 1ª..6ª => invertimos para notes.
  const notes = [];
  for (let i = 0; i < 6; i++) {
    const fret = fretsLH[i];
    if (fret == null) continue;
    if (fret < 0 || fret > maxFret) return null;
    const sIdx = 5 - i;
    const pc = mod12(STRINGS[sIdx].pc + fret);
    notes.push({ sIdx, fret, pc });
  }
  if (notes.length < 3) return null;

  // Bajo real (nota más grave)
  let bass = notes[0];
  for (const n of notes) {
    if (pitchAt(n.sIdx, n.fret) < pitchAt(bass.sIdx, bass.fret)) bass = n;
  }

  const minFret = Math.min(...notes.map((n) => n.fret));
  const maxF = Math.max(...notes.map((n) => n.fret));
  const span = maxF - minFret;

  return {
    frets: fretsToChordDbString(fretsLH),
    notes,
    bassKey: `${bass.sIdx}:${bass.fret}`,
    bassPc: bass.pc,
    minFret,
    maxFret: maxF,
    span,
    relIntervals: new Set(notes.map((n) => mod12(n.pc - rootPc))),
  };
}

function generateTriadVoicings({ rootPc, thirdOffset, fifthOffset, inversion, maxFret, maxSpan = 4 }) {
  const targets = [0, thirdOffset, fifthOffset].map((x) => mod12(rootPc + x));
  const degrees = [0, thirdOffset, fifthOffset].map(mod12);

  // Sets de triadas "tocables": combinaciones de 3 cuerdas con salto máximo de 2 cuerdas
  // (p.ej. permite 4-3-1 como en 43,35,15) para que haya opciones en rangos estrechos.
  const sets = [];
  for (let a = 0; a < 6; a++) {
    for (let b = a + 1; b < 6; b++) {
      for (let c = b + 1; c < 6; c++) {
        if (c - a <= 3) sets.push([a, b, c]);
      }
    }
  }

  const wantedBass = inversion === "1" ? mod12(thirdOffset) : inversion === "2" ? mod12(fifthOffset) : 0;

  // Permutaciones de asignación grado->cuerda (una nota por cuerda)
  const perms = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];

  const out = [];
  const seen = new Set();

  for (const set of sets) {
    for (const perm of perms) {
      const sA = set[0];
      const sB = set[1];
      const sC = set[2];

      const pcA = targets[perm[0]];
      const pcB = targets[perm[1]];
      const pcC = targets[perm[2]];

      const fa = fretsForPcOnString(sA, pcA, maxFret);
      const fb = fretsForPcOnString(sB, pcB, maxFret);
      const fc = fretsForPcOnString(sC, pcC, maxFret);

      for (const f1 of fa) {
        for (const f2 of fb) {
          for (const f3 of fc) {
            const minF = Math.min(f1, f2, f3);
            const maxF2 = Math.max(f1, f2, f3);
            const span = maxF2 - minF;
            if (span > maxSpan) continue;

            // Construye fretsLH: LowE..HighE
            const fretsLH = [null, null, null, null, null, null];
            // set: indices UI 0..5. LH index = 5 - sIdx
            fretsLH[5 - sA] = f1;
            fretsLH[5 - sB] = f2;
            fretsLH[5 - sC] = f3;

            const v = buildVoicingFromFretsLH({ fretsLH, rootPc, maxFret });
            if (!v) continue;

            // Exactamente 3 notas y exactamente {1,3,5}
            if (v.notes.length !== 3) continue;
            const rel = v.relIntervals;
            if (rel.size !== 3) continue;
            if (![0, mod12(thirdOffset), mod12(fifthOffset)].every((x) => rel.has(x))) continue;

            const bassInt = mod12(v.bassPc - rootPc);
            if (bassInt !== wantedBass) continue;

            const key = `${v.frets}|${wantedBass}`;
            if (seen.has(key)) continue;
            seen.add(key);

            out.push({ ...v, span });
          }
        }
      }
    }
  }

  out.sort((a, b) => (a.minFret - b.minFret) || (a.span - b.span) || (a.maxFret - b.maxFret));
  return out;
}

function generateTetradVoicings({ rootPc, thirdOffset, fifthOffset, seventhOffset, inversion, maxFret, maxSpan = 5 }) {
  const targets = [0, thirdOffset, fifthOffset, seventhOffset].map((x) => mod12(rootPc + x));
  const degrees = [0, thirdOffset, fifthOffset, seventhOffset].map(mod12);

  // 3 sets típicos de cuatriadas: (1-2-3-4), (2-3-4-5), (3-4-5-6)
  const sets = [
    [0, 1, 2, 3],
    [1, 2, 3, 4],
    [2, 3, 4, 5],
  ];

  const wantedBass =
    inversion === "1" ? mod12(thirdOffset) : inversion === "2" ? mod12(fifthOffset) : inversion === "3" ? mod12(seventhOffset) : 0;

  // Permutaciones 4!
  const perms = [];
  const arr = [0, 1, 2, 3];
  const permute = (a, l) => {
    if (l === a.length) {
      perms.push([...a]);
      return;
    }
    for (let i = l; i < a.length; i++) {
      [a[l], a[i]] = [a[i], a[l]];
      permute(a, l + 1);
      [a[l], a[i]] = [a[i], a[l]];
    }
  };
  permute(arr, 0);

  const out = [];
  const seen = new Set();

  for (const set of sets) {
    for (const perm of perms) {
      const s = set;
      const pcs = [targets[perm[0]], targets[perm[1]], targets[perm[2]], targets[perm[3]]];
      const fretsList = pcs.map((pc, idx) => fretsForPcOnString(s[idx], pc, maxFret));

      for (const f1 of fretsList[0]) {
        for (const f2 of fretsList[1]) {
          for (const f3 of fretsList[2]) {
            for (const f4 of fretsList[3]) {
              const minF = Math.min(f1, f2, f3, f4);
              const maxF2 = Math.max(f1, f2, f3, f4);
              const span = maxF2 - minF;
              if (span > maxSpan) continue;

              const fretsLH = [null, null, null, null, null, null];
              fretsLH[5 - s[0]] = f1;
              fretsLH[5 - s[1]] = f2;
              fretsLH[5 - s[2]] = f3;
              fretsLH[5 - s[3]] = f4;

              const v = buildVoicingFromFretsLH({ fretsLH, rootPc, maxFret });
              if (!v) continue;
              if (v.notes.length !== 4) continue;
              const rel = v.relIntervals;
              if (rel.size !== 4) continue;
              if (![0, mod12(thirdOffset), mod12(fifthOffset), mod12(seventhOffset)].every((x) => rel.has(x))) continue;

              const bassInt = mod12(v.bassPc - rootPc);
              if (bassInt !== wantedBass) continue;

              const key = `${v.frets}|${wantedBass}`;
              if (seen.has(key)) continue;
              seen.add(key);

              out.push({ ...v, span });
            }
          }
        }
      }
    }
  }

  out.sort((a, b) => (a.minFret - b.minFret) || (a.span - b.span) || (a.maxFret - b.maxFret));
  return out;
}

const CHORD_QUALITIES = [
  { value: "maj", label: "Mayor" },
  { value: "min", label: "Menor" },
  { value: "dim", label: "Disminuido" },
  { value: "hdim", label: "Semi-disminuido (ø)" },
];

const CHORD_STRUCTURES = [
  { value: "triad", label: "Triada" },
  { value: "tetrad", label: "Cuatriada" },
  { value: "chord", label: "Acorde" },
];

const CHORD_INVERSIONS = [
  { value: "root", label: "Posición fundamental" },
  { value: "1", label: "1ª inversión" },
  { value: "2", label: "2ª inversión" },
  { value: "3", label: "3ª inversión" },
];

function buildChordIntervals({ quality, structure, ext7, ext9, ext11, ext13 }) {
  const third = quality === "maj" ? 4 : 3; // min/dim/hdim -> m3
  const fifth = quality === "dim" || quality === "hdim" ? 6 : 7;

  const out = [0, third, fifth];

  // 7ª
  const wants7 = structure !== "triad";
  if (wants7) {
    let seventh = 10;
    if (quality === "maj") seventh = 11; // maj7
    if (quality === "dim") seventh = 9; // dim7 (bb7)
    if (quality === "hdim") seventh = 10; // ø7

    // en "Acorde" se puede desactivar 7 con el checkbox
    if (!(structure === "chord" && ext7 === false)) {
      out.push(seventh);
    }
  } else {
    // triada: si el usuario marca 7, lo añadimos
    if (ext7) {
      let seventh = 10;
      if (quality === "maj") seventh = 11;
      if (quality === "dim") seventh = 9;
      if (quality === "hdim") seventh = 10;
      out.push(seventh);
    }
  }

  // extensiones (solo en "Acorde")
  if (structure === "chord") {
    if (ext9) out.push(2);
    if (ext11) out.push(5);
    if (ext13) out.push(9);
  }

  return Array.from(new Set(out.map(mod12))).sort((a, b) => a - b);
}

function chordBassInterval({ quality, structure, inversion, chordIntervals }) {
  const third = quality === "maj" ? 4 : 3;
  const fifth = quality === "dim" || quality === "hdim" ? 6 : 7;

  const seventh = chordIntervals.find((x) => x === 9 || x === 10 || x === 11);
  const has7 = seventh != null && structure !== "triad";
  const degrees = has7 ? [0, third, fifth, seventh] : [0, third, fifth];

  if (inversion === "1") return degrees[1] ?? 0;
  if (inversion === "2") return degrees[2] ?? 0;
  if (inversion === "3") return degrees[3] ?? degrees[0];
  return degrees[0];
}

function intervalToChordToken(semi, { ext9, ext11, ext13 }) {
  const s = mod12(semi);
  const base = intervalToDegreeToken(s);

  if (ext9) {
    if (s === 1) return "b9";
    if (s === 2) return "9";
    if (s === 3) return "#9";
  }
  if (ext11) {
    if (s === 4) return "b11";
    if (s === 5) return "11";
    if (s === 6) return "#11";
  }
  if (ext13) {
    if (s === 8) return "b13";
    if (s === 9) return "13";
    if (s === 10) return "#13";
  }

  return base;
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
// CAGED (5 patrones)
// - No rompe lo existente: se añade como modo opcional.
// - Implementación "posicional": cada forma define una ventana de 5 trastes anclada en una raíz típica.
// ------------------------

const CAGED_ORDER = ["C", "A", "G", "E", "D"];
const CAGED_DEFS = [
  // En afinación estándar, las raíces típicas por forma:
  // C/A: raíz en 5ª cuerda (A string)
  // G/E: raíz en 6ª cuerda (E string)
  // D: raíz en 4ª cuerda (D string)
  // offsetStart = dónde empieza la ventana (relativo al traste de la raíz) según la forma abierta.
  { name: "C", typeIdx: 0, anchorSIdx: 4, offsetStart: -3 },
  { name: "A", typeIdx: 1, anchorSIdx: 4, offsetStart: 0 },
  { name: "G", typeIdx: 2, anchorSIdx: 5, offsetStart: -3 },
  { name: "E", typeIdx: 3, anchorSIdx: 5, offsetStart: 0 },
  { name: "D", typeIdx: 4, anchorSIdx: 3, offsetStart: 0 },
];

function findRootFretsOnString({ rootPc, sIdx, maxFret }) {
  const out = [];
  const base = STRINGS[sIdx].pc;
  for (let fret = 0; fret <= maxFret; fret++) {
    if (mod12(base + fret) === mod12(rootPc)) out.push(fret);
  }
  return out;
}

function buildCagedPatternInstances({ rootPc, scaleIntervals, maxFret }) {
  // CAGED funciona con cualquier conjunto de PCs (mayor, menor, modos, pentas, personalizada).
  const scalePcs = new Set(scaleIntervals.map((i) => mod12(rootPc + i)));
  const instances = [];

  for (const def of CAGED_DEFS) {
    const roots = findRootFretsOnString({ rootPc, sIdx: def.anchorSIdx, maxFret });

    for (const rootFret of roots) {
      // Ventana de 5 trastes. Si cae cerca de la cejuela, incluimos cuerda al aire (start=0)
      // en lugar de descartar la forma.
      const maxStart = Math.max(0, maxFret - 4);
      let start = rootFret + def.offsetStart;
      start = Math.max(0, Math.min(maxStart, start));
      if (start <= 1) start = 0; // asegura incluir traste 0 en 1ª posición
      let end = Math.min(maxFret, start + 4);

      const cells = new Set();
      for (let sIdx = 0; sIdx < 6; sIdx++) {
        for (let fret = start; fret <= end; fret++) {
          const pc = mod12(STRINGS[sIdx].pc + fret);
          if (scalePcs.has(pc)) cells.add(`${sIdx}:${fret}`);
        }
      }

      // Evita instancias demasiado vacías
      if (cells.size >= 10) {
        instances.push({
          typeIdx: def.typeIdx,
          letter: def.name,
          anchorFret: rootFret, // traste donde cae la raíz del shape (cuerda ancla)
          windowStart: start,
          windowEnd: end,
          rootFret,
          name: `CAGED ${def.name} @${start}`,
          cells,
        });
      }
    }
  }

  return instances;
}

function pickCagedViewPatterns({ instances, maxFret }) {
  // Queremos 5 shapes *posicionales* (una ventana por letra), NO la unión de todas las copias.
  // Si un shape existe en varias posiciones dentro del rango, elegimos una instancia "representativa"
  // para evitar fondos alternos por solapamientos masivos.
  const usableMaxStart = Math.max(0, maxFret - 4);
  const targets = [0, 1, 2, 3, 4].map((k) => Math.round((k * usableMaxStart) / 4));

  const chosen = [];
  for (let t = 0; t < 5; t++) {
    const letter = CAGED_ORDER[t];
    const def = CAGED_DEFS.find((d) => d.name === letter);
    if (!def) continue;

    const cands = instances
      .filter((x) => x.letter === letter)
      .filter((x) => x.windowStart >= 0 && x.windowStart <= usableMaxStart)
      .sort((a, b) => {
        const da = Math.abs(a.windowStart - targets[t]);
        const db = Math.abs(b.windowStart - targets[t]);
        if (da !== db) return da - db;
        return a.windowStart - b.windowStart;
      });

    const inst = cands[0];
    if (!inst) continue;

    chosen.push({
      idx: def.typeIdx, // 0..4 (C,A,G,E,D)
      name: `CAGED ${letter}`,
      cells: inst.cells,
      windowStart: inst.windowStart,
    });
  }

  return chosen;
}

function mergeCagedInstancesToPatterns(instances) {
  const patterns = CAGED_DEFS.map((d) => ({ idx: d.typeIdx, name: `CAGED ${d.name}`, cells: new Set() }));
  for (const inst of instances) {
    const p = patterns[inst.typeIdx];
    if (!p) continue;
    for (const key of inst.cells) p.cells.add(key);
  }
  // Orden C-A-G-E-D
  return CAGED_ORDER.map((letter) => patterns.find((p) => p.name.endsWith(letter))).filter(Boolean);
}

// ------------------------
// Pentatónicas: cajas (5 boxes) por ventanas de 5 trastes
// NOTA: en pentatónicas el concepto "box" es posicional; dejamos 2–3 notas/cuerda según ventana.
// ------------------------

// Pentatónicas: offsets de inicio de las 5 cajas (relativos a la raíz en 6ª cuerda)
// - Menor: patrón típico 0,3,5,7,10
// - Mayor: patrón típico 0,2,4,7,9
const PENTA_BOX_START_OFFSETS_MINOR = [0, 3, 5, 7, 10];
const PENTA_BOX_START_OFFSETS_MAJOR = [0, 2, 4, 7, 9];

function buildPentatonicBoxInstances({ rootPc, scaleIntervals, maxFret }) {
  if (scaleIntervals.length !== 5) return [];

  const scalePcs = new Set(scaleIntervals.map((i) => mod12(rootPc + i)));
  const rootFrets = findRootFretsOnLowE(rootPc, maxFret);

  const instances = [];
  const seen = new Set();

  const isMajorPenta =
    scaleIntervals.length === 5 &&
    scaleIntervals.every((v, i) => v === [0, 2, 4, 7, 9][i]);
  const isMinorPenta =
    scaleIntervals.length === 5 &&
    scaleIntervals.every((v, i) => v === [0, 3, 5, 7, 10][i]);

  const startOffsets = isMajorPenta
    ? PENTA_BOX_START_OFFSETS_MAJOR
    : isMinorPenta
      ? PENTA_BOX_START_OFFSETS_MINOR
      : PENTA_BOX_START_OFFSETS_MINOR;

  for (const rf of rootFrets) {
    for (let b = 0; b < 5; b++) {
      const boxStart = rf + startOffsets[b];
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

        const uniq = Array.from(new Set(frets.filter((x) => x >= 0 && x <= maxFret))).sort((a, b) => a - b);

        // Para que sea "box" real: 2 notas por cuerda.
        // Si hay 3 (pasos 2-2), cogemos extremos (borde inferior y superior)
        // para no "rellenar" el patrón.
        const pick = uniq.length <= 2 ? uniq : [uniq[0], uniq[uniq.length - 1]];
        pick.forEach((x) => cells.add(`${sIdx}:${x}`));
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

  const [customInput, setCustomInput] = useState("1 b3 5 6");

  // Extras (default OFF)
  const [extraInput, setExtraInput] = useState("b2");
  const [showExtra, setShowExtra] = useState(false);

  // Qué mástiles mostrar
  const [showBoards, setShowBoards] = useState({ scale: false, patterns: false, route: false, chords: false });

  // Modo de patrones para el 2º mástil (no afecta a rutas por defecto)
  // auto = comportamiento actual (pentas->boxes, 7 notas->3NPS)
  const [patternsMode, setPatternsMode] = useState("auto"); // auto | boxes | nps | caged

  // ------------------------
  // Acordes (panel opcional)
  // ------------------------
  const [chordRootPc, setChordRootPc] = useState(5); // F
  const [chordAccMode, setChordAccMode] = useState("auto"); // auto | sharps | flats
  const [chordQuality, setChordQuality] = useState("maj"); // maj|min|dim|hdim
  const [chordStructure, setChordStructure] = useState("triad"); // triad|tetrad|chord
  const [chordInversion, setChordInversion] = useState("root"); // root|1|2|3
  const [chordExt7, setChordExt7] = useState(false);
  const [chordExt9, setChordExt9] = useState(false);
  const [chordExt11, setChordExt11] = useState(false);
  const [chordExt13, setChordExt13] = useState(false);
  // Voicings de acordes (digitaciones tocables) desde dataset externo
  const [chordDb, setChordDb] = useState(null);
  const [chordDbError, setChordDbError] = useState(null);
  const [chordDbLastUrl, setChordDbLastUrl] = useState(null);
  const [chordVoicingIdx, setChordVoicingIdx] = useState(0);

  // ------------------------
  // Acordes (2): acordes cercanos por rango de trastes
  // - Hasta 4 acordes (slot 1 es base)
  // - Calcula digitaciones tocables dentro del rango y ordena por cercanía al acorde base
  // ------------------------
  const [nearFretFrom, setNearFretFrom] = useState(2);
  const [nearFretTo, setNearFretTo] = useState(7);
    const [nearSlots, setNearSlots] = useState(() => {
    // slot 0: base (por defecto, el mismo tono/calidad del panel principal)
    const base = {
      enabled: true,
      accMode: "auto", // auto | sharps | flats (solo para mostrar nombres)
      rootPc: 0, // C
      quality: "maj",
      structure: "triad",
      inversion: "root",
      ext7: false,
      ext9: false,
      ext11: false,
      ext13: false,
      selFrets: null,
    };
    const mkEmpty = () => ({
      enabled: false,
      accMode: "auto", // auto | sharps | flats
      rootPc: 7, // G
      quality: "maj",
      structure: "triad",
      inversion: "root",
      ext7: false,
      ext9: false,
      ext11: false,
      ext13: false,
      selFrets: null,
    });
    return [base, mkEmpty(), mkEmpty(), mkEmpty()];
  });

  const [nearBgColors, setNearBgColors] = useState([
    "#8ACAF4", // Acorde 1 (base)  RGB(138,202,244)
    "#8DE8AD", // Acorde 2        RGB(141,232,173)
    "#FFF475", // Acorde 3        RGB(255,244,117)
    "#F53845", // Acorde 4        RGB(245,56,69)
  ]);

  const [chordDbCache, setChordDbCache] = useState({}); // key => json
  const [chordDbCacheErr, setChordDbCacheErr] = useState({}); // key => string

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
    other: "#bababa",
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

  // Acordes: notación y tonos
  const chordAutoPreferSharps = useMemo(() => preferSharpsFromMajorTonicPc(chordRootPc), [chordRootPc]);
  const chordPreferSharps = chordAccMode === "auto" ? chordAutoPreferSharps : chordAccMode === "sharps";

  // Deletreo armónico del acorde: evita cosas como D–Gb–A (debe ser D–F#–A)
  const chordPcToSpelledName = (pc) => {
    const interval = mod12(pc - chordRootPc);
    const idx = chordIntervals.findIndex((x) => mod12(x) === interval);
    return idx >= 0 ? spelledChordNotes[idx] : pcToName(pc, chordPreferSharps);
  };

  const chordNoteOptions = useMemo(() => {
    const list = chordPreferSharps ? NOTES_SHARP : NOTES_FLAT;
    return list.map((n, i) => ({ label: n, pc: i }));
  }, [chordPreferSharps]);

  const chordIntervals = useMemo(
    () =>
      buildChordIntervals({
        quality: chordQuality,
        structure: chordStructure,
        ext7: chordExt7,
        ext9: chordExt9,
        ext11: chordExt11,
        ext13: chordExt13,
      }),
    [chordQuality, chordStructure, chordExt7, chordExt9, chordExt11, chordExt13]
  );

  const chordSuffix = useMemo(
    () =>
      chordSuffixFromUI({
        quality: chordQuality,
        structure: chordStructure,
        ext7: chordExt7,
        ext9: chordExt9,
        ext11: chordExt11,
        ext13: chordExt13,
      }),
    [chordQuality, chordStructure, chordExt7, chordExt9, chordExt11, chordExt13]
  );

  // Necesarios antes de filtrar voicings (evita TDZ)
  const chordThirdOffset = useMemo(() => (chordQuality === "maj" ? 4 : 3), [chordQuality]);
  const chordFifthOffset = useMemo(() => (chordQuality === "dim" || chordQuality === "hdim" ? 6 : 7), [chordQuality]);

  const chordBassInt = useMemo(
    () => chordBassInterval({ quality: chordQuality, structure: chordStructure, inversion: chordInversion, chordIntervals }),
    [chordQuality, chordStructure, chordInversion, chordIntervals]
  );
  const chordBassPc = useMemo(() => mod12(chordRootPc + chordBassInt), [chordRootPc, chordBassInt]);

  const chordPcs = useMemo(() => new Set(chordIntervals.map((i) => mod12(chordRootPc + i))), [chordIntervals, chordRootPc]);

  // Carga de digitaciones tocables (voicings)
  // Solo se necesita JSON cuando la estructura es "Acorde" (voicings completos).
  useEffect(() => {
    if (!showBoards.chords) return;

    if (chordStructure !== "chord") {
      setChordDb(null);
      setChordDbError(null);
      setChordDbLastUrl(null);
      return;
    }

    const suffix = chordSuffix;
    if (!suffix) {
      setChordDb(null);
      setChordDbError("No hay digitaciones para esta combinación (p.ej. menor add9 sin 7).");
      return;
    }

    let alive = true;
    const keyName = chordDbKeyNameFromPc(chordRootPc);
    const urlRel = chordDbUrl(keyName, suffix);
    const urlLocal = chordDbUrlLocal(keyName, suffix);
    const urlLocalAbs = new URL(urlLocal, window.location.href).href;
    const urlFallbackAbs = `https://raw.githubusercontent.com/a01653/mastil_escalas/main/public/${urlRel}`;

    setChordDbLastUrl(urlLocalAbs);

    (async () => {
      try {
        setChordDbError(null);

        let res = await fetch(urlLocal, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (!alive) return;
          setChordDbLastUrl(urlLocalAbs);
          setChordDb(json);
          setChordVoicingIdx(0);
          return;
        }

        const localStatus = res.status;
        res = await fetch(urlFallbackAbs, { cache: "no-store" });
        const fbStatus = res.status;
        if (!res.ok) throw new Error(`No pude cargar digitaciones: local ${urlLocalAbs} (${localStatus}) | fallback ${urlFallbackAbs} (${fbStatus})`);

        const json = await res.json();
        if (!alive) return;
        setChordDbLastUrl(urlFallbackAbs);
        setChordDb(json);
        setChordVoicingIdx(0);
      } catch (e) {
        if (!alive) return;
        setChordDb(null);
        setChordDbError(String(e?.message || e));
      }
    })();

    return () => {
      alive = false;
    };
  }, [showBoards.chords, chordRootPc, chordSuffix, chordStructure]);

  // Si se cierra el panel, limpia el último URL mostrado
  useEffect(() => {
    if (!showBoards.chords) setChordDbLastUrl(null);
  }, [showBoards.chords]);

  // Pre-carga de JSON para Acordes (2) cuando algún slot está en modo "Acorde"
  useEffect(() => {
    if (!showBoards.chords) return;

    const needed = [];
    for (let i = 0; i < nearSlots.length; i++) {
      const s = nearSlots[i];
      if (!s?.enabled) continue;
      if (s.structure !== "chord") continue;

      const intervals = buildChordIntervals({
        quality: s.quality,
        structure: s.structure,
        ext7: s.ext7,
        ext9: s.ext9,
        ext11: s.ext11,
        ext13: s.ext13,
      });

      const suffix = chordSuffixFromUI({
        quality: s.quality,
        structure: s.structure,
        ext7: s.ext7,
        ext9: s.ext9,
        ext11: s.ext11,
        ext13: s.ext13,
      });

      if (!suffix) continue;
      const keyName = chordDbKeyNameFromPc(s.rootPc);
      const urlRel = chordDbUrl(keyName, suffix);
      const cacheKey = `${keyName}/${suffix}`;
      if (chordDbCache[cacheKey] || chordDbCacheErr[cacheKey]) continue;
      needed.push({ cacheKey, urlRel });
    }

    if (!needed.length) return;

    let alive = true;
    (async () => {
      for (const it of needed) {
        try {
          const urlLocal = publicRelToLocal(it.urlRel);
          const urlLocalAbs = new URL(urlLocal, window.location.href).href;
          const urlFallbackAbs = `https://raw.githubusercontent.com/a01653/mastil_escalas/main/public/${it.urlRel}`;

          let res = await fetch(urlLocal, { cache: "no-store" });
          if (!res.ok) {
            const stLocal = res.status;
            res = await fetch(urlFallbackAbs, { cache: "no-store" });
            if (!res.ok) throw new Error(`${urlLocalAbs} (${stLocal}) | ${urlFallbackAbs} (${res.status})`);
          }

          const json = await res.json();
          if (!alive) return;
          setChordDbCache((prev) => ({ ...prev, [it.cacheKey]: json }));
        } catch (e) {
          if (!alive) return;
          setChordDbCacheErr((prev) => ({ ...prev, [it.cacheKey]: String(e?.message || e) }));
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [showBoards.chords, nearSlots, chordDbCache, chordDbCacheErr]);

  const chordVoicings = useMemo(() => {
    // 1) TRIADAS "reales" = 3 notas (3 cuerdas adyacentes)
    if (chordStructure === "triad" && !chordExt7) {
      const tri = generateTriadVoicings({
        rootPc: chordRootPc,
        thirdOffset: chordThirdOffset,
        fifthOffset: chordFifthOffset,
        inversion: chordInversion,
        maxFret,
        maxSpan: 4,
      });
      return tri.slice(0, 60);
    }

    // 2) CUATRIADAS "reales" = 4 notas (4 cuerdas adyacentes)
    const seventh = chordIntervals.find((x) => x === 9 || x === 10 || x === 11);
    const wantsTetrad = chordStructure === "tetrad" || (chordStructure === "triad" && chordExt7);
    if (wantsTetrad) {
      if (seventh == null) return [];
      const tet = generateTetradVoicings({
        rootPc: chordRootPc,
        thirdOffset: chordThirdOffset,
        fifthOffset: chordFifthOffset,
        seventhOffset: seventh,
        inversion: chordInversion,
        maxFret,
        maxSpan: 5,
      });
      return tet.slice(0, 60);
    }

    // 2.5) Caso especial: "solo 9" (add9 / m(add9)).
    // Mucha gente quiere 9 sin 7 (p.ej. Fadd9) y el JSON no siempre trae una digitación en rango.
    // Aquí generamos 4 notas tocables (cuerdas adyacentes) con grados 1–3–5–9.
    const only9 = chordStructure === "chord" && chordExt9 && !chordExt7 && !chordExt11 && !chordExt13;
    if (only9) {
      const quad = generateTetradVoicings({
        rootPc: chordRootPc,
        thirdOffset: chordThirdOffset,
        fifthOffset: chordFifthOffset,
        seventhOffset: 2, // 9
        inversion: chordInversion,
        maxFret,
        maxSpan: 5,
      });
      return quad.slice(0, 60);
    }

    // 3) ACORDES (voicings completos) = JSON (puede tener 5-6 cuerdas)
    const positions = chordDb?.positions || [];
    if (!Array.isArray(positions) || !positions.length) return [];

    // En acordes "reales" (con tensiones) es habitual OMITIR 5ª y/o tónica.
    // Si exigimos 1-3-5-7-9-11-13 exacto, casi no habrá inversions.
    // Por eso aquí:
    // - Permitimos omisiones (según lo seleccionado)
    // - Prohibimos notas fuera del acorde

    const allowed = new Set(chordIntervals.map(mod12));

    // Permitimos algunas extensiones "extra" frecuentes aunque el usuario no las marque
    // (para evitar 0 resultados en add9, etc.). No permitimos cromatismos tipo b9/#9 por defecto.
    const extraOk = new Set([2, 5, 9, 10, 11]); // 9, 11, 13, b7, 7

    // Requeridos mínimos según UI
    const required = new Set();
    required.add(mod12(chordThirdOffset));

    // Si NO hay 7/9/11/13, entonces esto es "acorde" pero realmente triada: exigir 1-3-5 para que no aparezcan cosas raras.
    const noTensions = !chordExt7 && !chordExt9 && !chordExt11 && !chordExt13;
    if (noTensions) {
      required.add(0);
      required.add(mod12(chordFifthOffset));
    } else {
      if (chordExt7) {
        const seventh = chordIntervals.find((x) => x === 9 || x === 10 || x === 11);
        if (seventh != null) required.add(mod12(seventh));
      }
      if (chordExt9) required.add(2);
      if (chordExt11) required.add(5);
      if (chordExt13) required.add(9);
    }

    // Bajo esperado según inversión
    const expectedBass = chordBassInt;

    const outStrict = [];
    const outLoose = [];
    const seen = new Set();

    for (const p of positions) {
      const fretsLH = parseChordDbFretsString(p?.frets);
      if (!fretsLH) continue;

      const v = buildVoicingFromFretsLH({ fretsLH, rootPc: chordRootPc, maxFret });
      if (!v) continue;

      const rel = v.relIntervals;

      // 1) Notas: preferimos solo notas del acorde, pero toleramos algunas extensiones extra (extraOk)
    // si no hay alternativas (p.ej. add9 con alguna 7ª/13ª en la digitación).

    let invalid = false;
    let extraCount = 0;
    for (const r of rel) {
      if (!allowed.has(r)) {
        if (extraOk.has(r)) extraCount++;
        else {
          invalid = true;
          break;
        }
      }
    }
    if (invalid) continue;

      // 2) Debe contener los requeridos
      for (const r of required) {
        if (!rel.has(r)) {
          invalid = true;
          break;
        }
      }
      if (invalid) continue;

      // 3) Inversión: si hay opciones con ese bajo, las preferimos.
      // Si no, mostramos slash chords (sin romper la selección del usuario).
      const bassInt = mod12(v.bassPc - chordRootPc);

      const key = `${v.frets}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // ranking: preferimos que incluya la tónica si existe, y también la 5ª si existe
      const hasRoot = rel.has(0);
      const hasFifth = rel.has(mod12(chordFifthOffset));
      const item = { ...v, _rank: (hasRoot ? 0 : 2) + (hasFifth ? 0 : 1), _extra: extraCount, _invMismatch: bassInt !== expectedBass };
      if (bassInt === expectedBass) outStrict.push(item);
      else outLoose.push(item);
    }

    const list = outStrict.length ? outStrict : outLoose;

    list.sort(
      (a, b) =>
        (a.minFret - b.minFret) ||
        (a.span - b.span) ||
        ((a._extra ?? 0) - (b._extra ?? 0)) ||
        ((a._rank ?? 0) - (b._rank ?? 0)) ||
        (a.maxFret - b.maxFret)
    );
    return list.slice(0, 60);
  }, [
    chordStructure,
    chordExt7,
    chordExt9,
    chordExt11,
    chordExt13,
    chordDb,
    chordRootPc,
    chordBassInt,
    chordThirdOffset,
    chordFifthOffset,
    chordIntervals,
    chordInversion,
    maxFret,
  ]);

  useEffect(() => {
    if (chordVoicingIdx >= chordVoicings.length && chordVoicings.length) setChordVoicingIdx(0);
  }, [chordVoicings.length]);

  const activeChordVoicing = chordVoicings[chordVoicingIdx] || null;

  // ------------------------
  // Acordes (2): cálculo de voicings en rango + ordenación por cercanía
  // ------------------------
  const nearSlotColors = ["#0f172a", "#2563eb", "#16a34a", "#f59e0b"]; // base, 2, 3, 4

  const nearFrom = Math.min(nearFretFrom, nearFretTo);
  const nearTo = Math.max(nearFretFrom, nearFretTo);

  function voicingBassNote(v) {
    if (!v?.notes?.length) return null;
    let bass = v.notes[0];
    for (const n of v.notes) {
      if (pitchAt(n.sIdx, n.fret) < pitchAt(bass.sIdx, bass.fret)) bass = n;
    }
    return bass;
  }

  function voicingCenterFret(v) {
    if (!v?.notes?.length) return 0;
    const sum = v.notes.reduce((a, n) => a + n.fret, 0);
    return sum / v.notes.length;
  }

  function voicingProximityCost(base, cand) {
    if (!base || !cand) return 0;
    const bb = voicingBassNote(base);
    const cb = voicingBassNote(cand);
    if (!bb || !cb) return 999;

    const bassF = Math.abs(cb.fret - bb.fret);
    const bassS = Math.abs(cb.sIdx - bb.sIdx);
    const minF = Math.abs((cand.minFret ?? cb.fret) - (base.minFret ?? bb.fret));
    const span = Math.abs((cand.span ?? 0) - (base.span ?? 0));
    const ctr = Math.abs(voicingCenterFret(cand) - voicingCenterFret(base));

    return 1.2 * bassF + 2.0 * bassS + 0.6 * minF + 0.3 * span + 0.4 * ctr;
  }

  function slotThirdOffset(quality) {
    return quality === "maj" ? 4 : 3;
  }

  function slotFifthOffset(quality) {
    return quality === "dim" || quality === "hdim" ? 6 : 7;
  }

  function buildSlotIntervals(slot) {
    return buildChordIntervals({
      quality: slot.quality,
      structure: slot.structure,
      ext7: slot.ext7,
      ext9: slot.ext9,
      ext11: slot.ext11,
      ext13: slot.ext13,
    });
  }

  function buildSlotVoicings(slot) {
    if (!slot?.enabled) return { voicings: [], err: null };

    const rootPc2 = mod12(slot.rootPc);
    const third = slotThirdOffset(slot.quality);
    const fifth = slotFifthOffset(slot.quality);
    const intervals = buildSlotIntervals(slot);

    // Filtrado por rango de trastes
    const inRange = (v) => {
      if (!v?.notes?.length) return false;
      const frets = v.notes.map((n) => n.fret).filter((f) => Number.isFinite(f));
      if (!frets.length) return false;
      const maxF = Math.max(...frets);
      if (maxF > nearTo) return false;
      // El límite inferior NO debería excluir cuerdas al aire: se ignoran frets=0.
      const fretted = frets.filter((f) => f > 0);
      const minEff = fretted.length ? Math.min(...fretted) : 0;
      return minEff >= nearFrom;
    };

    // TRIADA / CUATRIADA (generadas, tocables, cuerdas adyacentes)
    const seventh = intervals.find((x) => x === 9 || x === 10 || x === 11);
    const wantsTetrad = slot.structure === "tetrad" || (slot.structure === "triad" && slot.ext7);

    if (!wantsTetrad && slot.structure === "triad") {
      const tri = generateTriadVoicings({
        rootPc: rootPc2,
        thirdOffset: third,
        fifthOffset: fifth,
        inversion: slot.inversion,
        maxFret: nearTo,
        maxSpan: 4,
      }).filter(inRange);

      return { voicings: tri, err: tri.length ? null : "No encontré triadas en ese rango" };
    }

    if (wantsTetrad) {
      if (seventh == null) return { voicings: [], err: "No hay 7ª para esta combinación" };
      const tet = generateTetradVoicings({
        rootPc: rootPc2,
        thirdOffset: third,
        fifthOffset: fifth,
        seventhOffset: seventh,
        inversion: slot.inversion,
        maxFret: nearTo,
        maxSpan: 5,
      }).filter(inRange);

      return { voicings: tet, err: tet.length ? null : "No encontré cuatriadas en ese rango" };
    }

    // ACORDE (JSON) — lo usamos solo si el slot está en "Acorde"
    if (slot.structure === "chord") {
      // Caso especial: "solo 9" (add9 / m(add9)) -> generamos 4 notas tocables.
      if (slot.ext9 && !slot.ext7 && !slot.ext11 && !slot.ext13) {
        const quad = generateTetradVoicings({
          rootPc: rootPc2,
          thirdOffset: third,
          fifthOffset: fifth,
          seventhOffset: 2, // 9
          inversion: slot.inversion,
          maxFret: nearTo,
          maxSpan: 5,
        }).filter(inRange);
        return { voicings: quad, err: quad.length ? null : "No hay add9 en rango" };
      }
      const suffix = chordSuffixFromUI({
        quality: slot.quality,
        structure: slot.structure,
        ext7: slot.ext7,
        ext9: slot.ext9,
        ext11: slot.ext11,
        ext13: slot.ext13,
      });

      if (!suffix) return { voicings: [], err: "No hay JSON para esta combinación" };

      const keyName = chordDbKeyNameFromPc(rootPc2);
      const cacheKey = `${keyName}/${suffix}`;
      const json = chordDbCache[cacheKey];
      const err = chordDbCacheErr[cacheKey];
      if (err) return { voicings: [], err: `Error JSON: ${err}` };
      if (!json) return { voicings: [], err: "Cargando JSON…" };

      const allowed = new Set(intervals.map(mod12));
      const required = new Set();
      required.add(mod12(third));

      const noTensions = !slot.ext7 && !slot.ext9 && !slot.ext11 && !slot.ext13;
      if (noTensions) {
        required.add(0);
        required.add(mod12(fifth));
      } else {
        if (slot.ext7 && seventh != null) required.add(mod12(seventh));
        if (slot.ext9) required.add(2);
        if (slot.ext11) required.add(5);
        if (slot.ext13) required.add(9);
      }

      const bassInt = chordBassInterval({ quality: slot.quality, structure: slot.structure, inversion: slot.inversion, chordIntervals: intervals });

      const outStrict = [];
      const outLoose = [];
      const seen = new Set();
      for (const p of json.positions || []) {
        const fretsLH = parseChordDbFretsString(p?.frets);
        if (!fretsLH) continue;
        const v = buildVoicingFromFretsLH({ fretsLH, rootPc: rootPc2, maxFret: nearTo });
        if (!v) continue;
        if (!inRange(v)) continue;

        // Permitimos que el JSON traiga alguna tensión extra (p.ej. b7/7/13) aunque no esté marcada,
        // para evitar 0 resultados en add9, etc. Se penaliza en el orden.
        const extraOk = new Set([2, 5, 9, 10, 11]); // 9/11/13/b7/7
        let invalid = false;
        let extraCount = 0;
        for (const r of v.relIntervals) {
          if (!allowed.has(r)) {
            if (extraOk.has(r)) extraCount++;
            else {
              invalid = true;
              break;
            }
          }
        }
        if (invalid) continue;
        for (const r of required) {
          if (!v.relIntervals.has(r)) {
            invalid = true;
            break;
          }
        }
        if (invalid) continue;

        const bi = mod12(v.bassPc - rootPc2);

        const key = `${v.frets}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const item = { ...v, _extra: extraCount };
        if (bi === bassInt) outStrict.push(item);
        else outLoose.push(item);
      }

      const list = outStrict.length ? outStrict : outLoose;

      list.sort((a, b) => ((a._extra ?? 0) - (b._extra ?? 0)) || (a.minFret - b.minFret) || (a.span - b.span) || (a.maxFret - b.maxFret));
      return { voicings: list.slice(0, 60), err: list.length ? null : "No hay voicings en rango" };
    }

    return { voicings: [], err: "Estructura no soportada" };
  }

  const nearComputed = useMemo(() => {
    const slots = nearSlots.map((s) => buildSlotVoicings(s));

    // Base (slot 0)
    const baseList = slots[0]?.voicings || [];
    const baseSelFrets = nearSlots[0]?.selFrets;
    const base = baseSelFrets ? baseList.find((v) => v.frets === baseSelFrets) : null;
    const baseVoicing = base || baseList[0] || null;

    // Sugerencias por cercanía (slots 2..4)
    const ranked = slots.map((x, idx) => {
      if (idx === 0) return { ...x, ranked: x.voicings || [] };
      const arr = (x.voicings || []).map((v) => ({ ...v, _cost: voicingProximityCost(baseVoicing, v) }));
      arr.sort((a, b) => (a._cost - b._cost) || (a.minFret - b.minFret) || (a.span - b.span));
      return { ...x, ranked: arr.slice(0, 40) };
    });

    // Voicing seleccionado por slot (por frets)
    const selected = ranked.map((r, idx) => {
      const sel = nearSlots[idx]?.selFrets;
      const list = r.ranked || [];
      const v = sel ? list.find((x) => x.frets === sel) : null;
      return v || list[0] || null;
    });

    return { ranked, selected, baseVoicing };
  }, [nearSlots, nearFrom, nearTo, chordDbCache, chordDbCacheErr, maxFret]);


  const spelledChordNotes = useMemo(
    () => spellScaleNotes({ rootPc: chordRootPc, scaleIntervals: chordIntervals, preferSharps: chordPreferSharps }),
    [chordRootPc, chordIntervals, chordPreferSharps]
  );

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

  function chordRoleOfPc(pc) {
    const interval = mod12(pc - chordRootPc);
    if (interval === 0) return "root";
    if (interval === chordThirdOffset) return "third";
    if (interval === chordFifthOffset) return "fifth";
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

  function labelForChordPc(pc) {
    const interval = mod12(pc - chordRootPc);
    const itv = intervalToChordToken(interval, { ext9: chordExt9 && chordStructure === "chord", ext11: chordExt11 && chordStructure === "chord", ext13: chordExt13 && chordStructure === "chord" });
    const note = chordPcToSpelledName(pc);

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

  function setNearBgColor(idx, value) {
    setNearBgColors((arr) => {
      const next = [...arr];
      next[idx] = value;
      return next;
    });
  }

  // Patrones (para el 2º mástil)
  const patternsMerged = useMemo(() => {
    // AUTO: mantiene el comportamiento existente
    if (patternsMode === "auto") {
      if (isPentatonicScale && scaleIntervals.length === 5) {
        const inst = buildPentatonicBoxInstances({ rootPc, scaleIntervals, maxFret });
        return mergeInstancesToPatterns(inst, 5, "Box");
      }
      if (!isPentatonicScale && scaleIntervals.length === 7) {
        return build3NpsPatternsMerged({ rootPc, scaleIntervals, maxFret });
      }
      return [];
    }

    if (patternsMode === "caged") {
      const inst = buildCagedPatternInstances({ rootPc, scaleIntervals, maxFret });
      return pickCagedViewPatterns({ instances: inst, maxFret });
    }

    if (patternsMode === "boxes") {
      if (scaleIntervals.length === 5) {
        const inst = buildPentatonicBoxInstances({ rootPc, scaleIntervals, maxFret });
        return mergeInstancesToPatterns(inst, 5, "Box");
      }
      return [];
    }

    if (patternsMode === "nps") {
      if (scaleIntervals.length === 7) return build3NpsPatternsMerged({ rootPc, scaleIntervals, maxFret });
      return [];
    }

    return [];
  }, [patternsMode, isPentatonicScale, rootPc, scaleIntervals, maxFret]);

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

  const cagedInstances = useMemo(() => {
    return buildCagedPatternInstances({ rootPc, scaleIntervals, maxFret });
  }, [rootPc, scaleIntervals, maxFret]);

  const cagedMembership = useMemo(() => buildInstanceMembershipMap(cagedInstances), [cagedInstances]);

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
      } else if (m === "caged") {
        internalMode = "pattern";
        instances = cagedInstances;
        membership = cagedMembership;
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
      // Mantiene comportamiento previo (no añade CAGED a auto para no romper resultados existentes)
      if (isPentatonicScale) return pickBest(["penta", "pos", "free"]);
      if (scaleIntervals.length === 7) return pickBest(["nps", "pos", "free"]);
      return pickBest(["pos", "free"]);
    }

    // Manual
    if (routeMode === "penta" && isPentatonicScale) return pickBest(["penta"]);
    if (routeMode === "nps" && !isPentatonicScale && scaleIntervals.length === 7) return pickBest(["nps"]);
    if (routeMode === "caged") return pickBest(["caged"]);
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

  function InlayMark({ fret, sIdx }) {
    // Puntos tipo guitarra (inlays)
    // - punto simple: entre cuerdas 3 y 4 (debajo de la 3ª)
    // - doble punto (12/24): entre 2–3 y 4–5
    const Dot = () => (
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-slate-300 opacity-95"
        style={{ bottom: -10, zIndex: 5 }}
      />
    );

    if (INLAY_SINGLE.has(fret) && sIdx === 2) return <Dot />;
    if (INLAY_DOUBLE.has(fret) && (sIdx === 1 || sIdx === 3)) return <Dot />;
    return null;
  }

  function Circle({ pc, role, fret, sIdx, badge }) {
    const baseRole = role === "extra" ? "extra" : role;
    return (
      <div
        className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold"
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

  function ChordCircle({ pc, role, fret, sIdx, isBass }) {
    const baseRole = role;
    const extraRing = isBass ? `inset 0 0 0 3px ${rgba(colors.route, 0.9)}` : "none";

    return (
      <div
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold"
        style={{ ...circleStyle(baseRole), boxShadow: `${circleStyle(baseRole).boxShadow}, ${extraRing}` }}
        title={`${chordPcToSpelledName(pc)} | ${intervalToChordToken(mod12(pc - chordRootPc), { ext9: chordExt9 && chordStructure === "chord", ext11: chordExt11 && chordStructure === "chord", ext13: chordExt13 && chordStructure === "chord" })} | cuerda ${sIdx + 1}, traste ${fret}`}
      >
        {labelForChordPc(pc)}
        {isBass ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] text-white">
            B
          </span>
        ) : null}
      </div>
    );
  }

  function ChordFretboard({ title, voicing, voicingIdx, voicingTotal }) {
    const cellMap = new Map();
    if (voicing?.notes) {
      for (const n of voicing.notes) {
        cellMap.set(`${n.sIdx}:${n.fret}`, n);
      }
    }

    return (
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-800">{title}</div>
            <div className="text-xs text-slate-600">Notas: {spelledChordNotes.join(" – ")}</div>
            <div className="text-xs text-slate-600">Digitación real (una nota por cuerda). Resalta tónica/3ª/5ª (B = bajo = nota más grave).</div>
          </div>
          <div className="text-xs text-slate-600">
            {voicing ? (
              <>
                Voicing <b>{voicingIdx + 1}</b>/{voicingTotal} · frets <b>{voicing.frets}</b>
              </>
            ) : (
              <span className="font-semibold text-rose-600">No hay digitación tocable en 0–{maxFret} para esta inversión.</span>
            )}
          </div>
        </div>

        <div className="mb-3 space-y-1 text-xs text-slate-600">
          <div>
            Intervalos:{" "}
            {chordIntervals
              .map((i) =>
                intervalToChordToken(i, {
                  ext9: chordExt9 && chordStructure === "chord",
                  ext11: chordExt11 && chordStructure === "chord",
                  ext13: chordExt13 && chordStructure === "chord",
                })
              )
              .join(" – ")}
          </div>
          <div>Notas: {spelledChordNotes.join(" – ")}</div>
          <div className="text-[11px] text-slate-500">Si eliges Posición fundamental, el bajo (nota más grave) es la tónica.</div>
        </div>

        <div className="grid items-center gap-1" style={{ gridTemplateColumns: fretGridCols(maxFret) }}>
          <div className="text-xs font-semibold text-slate-600">Cuerda</div>
          {Array.from({ length: maxFret + 1 }, (_, fret) => (
            <div key={fret} className="relative flex flex-col items-center">
              <div className="text-[10px] text-slate-600">{fret}</div>
              
            </div>
          ))}
        </div>

        <div className="mt-2 space-y-1">
          {STRINGS.map((st, sIdx) => (
            <div key={st.label} className="grid items-center gap-1" style={{ gridTemplateColumns: fretGridCols(maxFret) }}>
              <div className="text-xs font-medium text-slate-700">{st.label}</div>

              {Array.from({ length: maxFret + 1 }, (_, fret) => {
                const cellKey = `${sIdx}:${fret}`;
                const n = cellMap.get(cellKey);
                const pc = n ? n.pc : mod12(st.pc + fret);
                const inVoicing = !!n;
                const role = inVoicing ? chordRoleOfPc(pc) : "other";
                const isBass = inVoicing && voicing?.bassKey === cellKey;

                return (
                  <div key={`${sIdx}-${fret}`} className={`relative flex h-10 overflow-visible items-center justify-center rounded-lg border ${fret === 0 ? "border-slate-300" : "border-slate-200"}`} style={{ backgroundColor: "#f8fafc" }}>
                    <InlayMark fret={fret} sIdx={sIdx} />
                    {inVoicing ? <ChordCircle pc={pc} role={role} fret={fret} sIdx={sIdx} isBass={isBass} /> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Mástil combinado para "Acordes cercanos" (hasta 4)
  function NearChordsFretboard() {
    // cellKey -> [{slotIdx, pc, isBass, role}...]
    const slotNoteMaps = useMemo(() => {
      return nearSlots.map((slot, idx) => {
        const m = new Map();
        if (!slot?.enabled) return m;
        const v = nearComputed.selected[idx];
        if (!v?.notes?.length) return m;
        for (const n of v.notes) {
          const key = `${n.sIdx}:${n.fret}`;
          m.set(key, { pc: n.pc, isBass: v.bassKey === key });
        }
        return m;
      });
    }, [nearSlots, nearComputed.selected]);

    function slotRoleOfPc(pc, slot) {
      const interval = mod12(pc - slot.rootPc);
      const third = slotThirdOffset(slot.quality);
      const fifth = slotFifthOffset(slot.quality);
      if (interval === 0) return "root";
      if (interval === third) return "third";
      if (interval === fifth) return "fifth";
      return "other";
    }

    // Fondo por acorde (claro). Si hay solape, diagonal.
    function bgForCell(items) {
      if (!items.length) return {};
      const c1 = rgba(nearBgColors[items[0].slotIdx] || "#e2e8f0", 0.55);
      if (items.length === 1) return { backgroundColor: c1 };
      const c2 = rgba(nearBgColors[items[1].slotIdx] || "#e2e8f0", 0.55);
      return { backgroundImage: `linear-gradient(135deg, ${c1} 0%, ${c1} 50%, ${c2} 50%, ${c2} 100%)` };
    }

    // Posicionamiento en esquinas SIN clases dinámicas (Tailwind no las compila si son variables).
    function cornerStyle(n, idx) {
      const pad = 4;
      if (n === 2) return idx === 0 ? { left: pad, top: pad } : { right: pad, bottom: pad };
      if (n === 3) return idx === 0 ? { left: pad, top: pad } : idx === 1 ? { right: pad, top: pad } : { left: pad, bottom: pad };
      return idx === 0
        ? { left: pad, top: pad }
        : idx === 1
          ? { right: pad, top: pad }
          : idx === 2
            ? { left: pad, bottom: pad }
            : { right: pad, bottom: pad };
    }

    function Mini({ slotIdx, pc, isBass, role, fret, sIdx, size = "m" }) {
      const bg = colors[role] || colors.other;
      const dark = isDark(bg);

      const preferSharpsSlot = preferSharpsFromMajorTonicPc(nearSlots[slotIdx].rootPc);
      const note = pcToName(pc, preferSharpsSlot);
      const interval = mod12(pc - nearSlots[slotIdx].rootPc);
      const tok = intervalToChordToken(interval, {
        ext9: !!nearSlots[slotIdx].ext9 && nearSlots[slotIdx].structure === "chord",
        ext11: !!nearSlots[slotIdx].ext11 && nearSlots[slotIdx].structure === "chord",
        ext13: !!nearSlots[slotIdx].ext13 && nearSlots[slotIdx].structure === "chord",
      });

      const showI = !!showIntervalsLabel;
      const showN = !!showNotesLabel;

      return (
        <div
          className={`relative z-10 inline-flex items-center justify-center rounded-full font-bold ${size === "s" ? "h-6 w-6 text-[9px]" : "h-7 w-7 text-[10px]"}`}
          style={{
            backgroundColor: bg,
            color: dark ? "#fff" : "#0f172a",
            boxShadow: isBass
              ? `inset 0 0 0 2px ${rgba(colors.route, 0.95)}`
              : `0 0 0 1px ${rgba(bg, 0.35)}`,
          }}
          title={`${note} · ${tok} · cuerda ${sIdx + 1} traste ${fret}${isBass ? " · BAJO" : ""}`}
        >
          {showI && showN ? `${tok}-${note}` : showI ? tok : note}
        </div>
      );
    }

    const activeCount = nearSlots.filter((s) => s?.enabled).length;

    return (
      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-800">Mástil: acordes cercanos (todos)</div>
            <div className="text-xs text-slate-600">
              Fondo = color por acorde · círculos: colores por función (1/3/5/otras) · texto = nota/intervalo · anillo = bajo.
            </div>
          </div>
          <div className="text-xs text-slate-600">Activos: {activeCount ? nearSlots.map((s, i) => (s?.enabled ? `A${i + 1}` : null)).filter(Boolean).join(" · ") : "(ninguno)"}</div>
        </div>

        <div className="grid items-center gap-1" style={{ gridTemplateColumns: fretGridCols(maxFret) }}>
          <div className="text-xs font-semibold text-slate-600">Cuerda</div>
          {Array.from({ length: maxFret + 1 }, (_, fret) => (
            <div key={fret} className="relative flex flex-col items-center">
              <div className="text-[10px] text-slate-600">{fret}</div>
              
            </div>
          ))}
        </div>

        <div className="mt-2 space-y-1">
          {STRINGS.map((st, sIdx) => (
            <div key={st.label} className="grid items-center gap-1" style={{ gridTemplateColumns: fretGridCols(maxFret) }}>
              <div className="text-xs font-medium text-slate-700">{st.label}</div>

              {Array.from({ length: maxFret + 1 }, (_, fret) => {
                const cellKey = `${sIdx}:${fret}`;
                const items = [];
                for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
                  if (!nearSlots[slotIdx]?.enabled) continue;
                  const n = slotNoteMaps[slotIdx].get(cellKey);
                  if (!n) continue;
                  const role = slotRoleOfPc(n.pc, nearSlots[slotIdx]);
                  items.push({ slotIdx, pc: n.pc, isBass: n.isBass, role });
                }

                return (
                  <div
                    key={`${sIdx}-${fret}`}
                    className={`relative flex h-10 overflow-visible items-center justify-center rounded-lg border ${fret === 0 ? "border-slate-300" : "border-slate-200"}`}
                    style={{ backgroundColor: "#f8fafc", ...bgForCell(items) }}>
                    <InlayMark fret={fret} sIdx={sIdx} />
                    {items.length === 1 ? (
                      <div className="pointer-events-none">
                        <Mini
                          size="m"
                          slotIdx={items[0].slotIdx}
                          pc={items[0].pc}
                          isBass={items[0].isBass}
                          role={items[0].role}
                          fret={fret}
                          sIdx={sIdx}
                        />
                      </div>
                    ) : items.length ? (
                      <div className="absolute inset-0 pointer-events-none">
                        {items
                          .slice()
                          .sort((a, b) => a.slotIdx - b.slotIdx)
                          .slice(0, 4)
                          .map((it, i2) => {
                            const pos = cornerStyle(items.length, i2);
                            return (
                              <div key={`${it.slotIdx}-${it.role}`} className="absolute" style={pos}>
                                <Mini
                                  size="s"
                                  slotIdx={it.slotIdx}
                                  pc={it.pc}
                                  isBass={it.isBass}
                                  role={it.role}
                                  fret={fret}
                                  sIdx={sIdx}
                                />
                              </div>
                            );
                          })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
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
          style={{ gridTemplateColumns: fretGridCols(maxFret) }}
        >
          <div className="text-xs font-semibold text-slate-600">Cuerda</div>
          {Array.from({ length: maxFret + 1 }, (_, fret) => (
            <div key={fret} className="relative flex flex-col items-center">
              <div className="text-[10px] text-slate-600">{fret}</div>
              
            </div>
          ))}
        </div>

        <div className="mt-2 space-y-1">
          {STRINGS.map((st, sIdx) => (
            <div
              key={st.label}
              className="grid items-center gap-1"
              style={{ gridTemplateColumns: fretGridCols(maxFret) }}
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
                    className={`relative flex h-10 overflow-visible items-center justify-center rounded-lg border ${
                      fret === 0 ? "border-slate-300" : "border-slate-200"
                    } ${mode === "route" && inScale ? "cursor-pointer hover:ring-2 hover:ring-slate-300" : ""}`}
                    style={{ backgroundColor: "#f8fafc", ...bgPat, ...bgRoute }}>
                    <InlayMark fret={fret} sIdx={sIdx} />
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
          <h1 className="text-2xl font-semibold">Mástil interactivo: escalas, patrones, rutas y acordes</h1>
          <p className="text-sm text-slate-600">
            Patrones: <b>5 boxes</b> (pentatónicas), <b>7 3NPS</b> (7 notas) y <b>CAGED</b>. Ruta: sigue la escala en orden y se restringe a patrones.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          {/* IZQUIERDA */}
          <div className="space-y-4">
            {/* CONFIG */}
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="grid gap-3 md:grid-cols-12 items-start">
                {/* Nota raíz */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium">Nota raíz</label>
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                      value={rootPc}
                      onChange={(e) => setRootPc(parseInt(e.target.value, 10))}
                    >
                      {noteOptions.map((o) => (
                        <option key={o.pc} value={o.pc}>
                          {o.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold shadow-sm hover:bg-slate-50"
                      title="Bajar 1 semitono"
                      onClick={() => {
                        setRootPc((pc) => mod12(pc - 1));
                        setAccMode("flats");
                      }}
                    >
                      ♭
                    </button>
                    <button
                      type="button"
                      className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold shadow-sm hover:bg-slate-50"
                      title="Subir 1 semitono"
                      onClick={() => {
                        setRootPc((pc) => mod12(pc + 1));
                        setAccMode("sharps");
                      }}
                    >
                      ♯
                    </button>
                  </div>
                </div>

                {/* Escala */}
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

                {/* Trastes */}
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

                {/* Vista */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Vista</label>
                  <div className="mt-1 flex gap-2">
                    <ToggleButton active={showNotesLabel} onClick={() => setShowNotesLabel((v) => !v)}>
                      Notas
                    </ToggleButton>
                    <ToggleButton active={showIntervalsLabel} onClick={() => setShowIntervalsLabel((v) => !v)}>
                      Intervalos
                    </ToggleButton>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">Si activas ambas: 1–F dentro del círculo.</div>
                </div>

                {scaleName === "Personalizada" ? (
                  <div className="md:col-span-12">
                    <label className="block text-sm font-medium">Intervalos (escala personalizada)</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Ej: 1 b3 5 6 (o semitonos: s0 s3 s7 s9)"
                    />
                    <div className="mt-1 text-[11px] text-slate-500">Admite grados (b3, #4), semitonos (s0–s11) o notas. La raíz siempre se añade.</div>
                  </div>
                ) : null}
              </div>

              {/* Notación / mostrar / extra */}
              <div className="mt-4 grid gap-3 md:grid-cols-12 items-start">
                <div className="md:col-span-4">
                  <label className="block text-sm font-medium">Notación</label>
                  <div className="mt-1 flex gap-2">
                    <ToggleButton active={accMode === "auto"} onClick={() => setAccMode("auto")}>
                      Auto
                    </ToggleButton>
                    <ToggleButton active={accMode === "sharps"} onClick={() => setAccMode("sharps")}>
                      #
                    </ToggleButton>
                    <ToggleButton active={accMode === "flats"} onClick={() => setAccMode("flats")}>
                      b
                    </ToggleButton>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">Auto usa la armadura esperada (ej. F mayor ⇒ Bb, no A#).</div>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm font-medium">Mostrar</label>
                  <div className="mt-1 flex gap-2">
                    <ToggleButton active={showNonScale} onClick={() => setShowNonScale((v) => !v)}>
                      Ver todo
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
                    placeholder="Ej: b2"
                  />
                </div>
              </div>

              {/* Ruta */}
              <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-800">Ruta musical</div>
                  <div className="text-xs text-slate-600">Click en el mástil de ruta para elegir: <b>{routePickNext === "start" ? "Inicio" : "Fin"}</b></div>
                </div>

                <div className="grid gap-3 md:grid-cols-12 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700">Inicio</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                      value={routeStartCode}
                      onChange={(e) => setRouteStartCode(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700">Fin</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                      value={routeEndCode}
                      onChange={(e) => setRouteEndCode(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700">Máx. notas seguidas/cuerda</label>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
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
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                      value={routeMode}
                      onChange={(e) => setRouteMode(e.target.value)}
                    >
                      <option value="auto">Auto</option>
                      <option value="free">Libre</option>
                      <option value="pos">Posición/diagonal</option>
                      {isPentatonicScale ? <option value="penta">Pentatónica (boxes)</option> : null}
                      {!isPentatonicScale && scaleIntervals.length === 7 ? <option value="nps">3NPS</option> : null}
                      <option value="caged">CAGED</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700">Patrón</label>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                      value={routeFixedPattern}
                      onChange={(e) => setRouteFixedPattern(e.target.value)}
                    >
                      <option value="auto">Auto</option>
                      {Array.from({ length: scaleIntervals.length === 7 ? 7 : scaleIntervals.length === 5 ? 5 : 0 }, (_, i) => (
                        <option key={i} value={String(i)}>
                          {scaleIntervals.length === 7 ? `3NPS ${i + 1}` : `Patrón ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ToggleButton active={routePreferNps} onClick={() => setRoutePreferNps((v) => !v)}>
                    Preferir NPS
                  </ToggleButton>
                  <ToggleButton active={routePreferVertical} onClick={() => setRoutePreferVertical((v) => !v)}>
                    Preferir vertical
                  </ToggleButton>
                  <ToggleButton active={routeKeepPattern} onClick={() => setRouteKeepPattern((v) => !v)}>
                    Mantener patrón
                  </ToggleButton>
                  <ToggleButton active={allowPatternSwitch} onClick={() => setAllowPatternSwitch((v) => !v)}>
                    Permite cambio patrón
                  </ToggleButton>

                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">Coste cambio</span>
                    <input
                      type="range"
                      min={0}
                      max={8}
                      step={0.5}
                      value={patternSwitchPenalty}
                      onChange={(e) => setPatternSwitchPenalty(parseFloat(e.target.value))}
                    />
                    <span className="text-xs text-slate-600 w-10 text-right">{patternSwitchPenalty.toFixed(1)}</span>
                  </div>
                </div>

                <div className="mt-2 text-[11px] text-slate-500">La ruta recorre la escala en orden (asc/desc) y minimiza movimientos. En modo patrón, restringe a boxes/3NPS/CAGED.</div>
              </div>

              {/* Toggles de mástiles */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-slate-800">Mástiles:</div>
                <ToggleButton active={showBoards.scale} onClick={() => setShowBoards((s) => ({ ...s, scale: !s.scale }))}>
                  Escala
                </ToggleButton>
                <ToggleButton active={showBoards.patterns} onClick={() => setShowBoards((s) => ({ ...s, patterns: !s.patterns }))}>
                  Patrones
                </ToggleButton>
                <ToggleButton active={showBoards.route} onClick={() => setShowBoards((s) => ({ ...s, route: !s.route }))}>
                  Ruta
                </ToggleButton>
                <ToggleButton active={showBoards.chords} onClick={() => setShowBoards((s) => ({ ...s, chords: !s.chords }))}>
                  Acordes
                </ToggleButton>

                <div className="ml-auto flex items-center gap-2">
                  <div className="text-sm font-semibold text-slate-800">Modo patrones:</div>
                  <select
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                    value={patternsMode}
                    onChange={(e) => setPatternsMode(e.target.value)}
                  >
                    <option value="auto">Auto</option>
                    <option value="boxes">Boxes</option>
                    <option value="nps">3NPS</option>
                    <option value="caged">CAGED</option>
                  </select>
                </div>
              </div>
            </section>

            {showBoards.scale ? <Fretboard title="Mástil" subtitle="Escala + (opcional) extras. Resalta raíz/3ª/5ª." mode="scale" /> : null}
            {showBoards.patterns ? <Fretboard title="Patrones" subtitle="Fondo indica patrón (Boxes / 3NPS / CAGED)." mode="patterns" /> : null}
            {showBoards.route ? <Fretboard title="Ruta" subtitle="Ruta musical restringida a patrones (o libre)." mode="route" /> : null}

            {/* ACORDES */}
            {showBoards.chords ? (
              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="mb-2">
                  <div className="text-sm font-semibold text-slate-800">Acordes</div>
                  <div className="text-xs text-slate-600">Panel independiente (no afecta a escalas/rutas). B = bajo (nota más grave del voicing).</div>
                </div>

                <div className="grid gap-3 md:grid-cols-12 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-semibold text-slate-700">Tono</label>
                    <div className="mt-1 flex items-center gap-2">
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                        value={chordRootPc}
                        onChange={(e) => setChordRootPc(parseInt(e.target.value, 10))}
                      >
                        {NOTES_SHARP.map((n, pc) => (
                          <option key={pc} value={pc}>
                            {n}{NOTES_FLAT[pc] !== n ? ` / ${NOTES_FLAT[pc]}` : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold shadow-sm hover:bg-slate-50"
                        title="Bajar 1 semitono"
                        onClick={() => {
                          setChordRootPc((pc) => mod12(pc - 1));
                          setChordAccMode("flats");
                        }}
                      >
                        ♭
                      </button>
                      <button
                        type="button"
                        className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold shadow-sm hover:bg-slate-50"
                        title="Subir 1 semitono"
                        onClick={() => {
                          setChordRootPc((pc) => mod12(pc + 1));
                          setChordAccMode("sharps");
                        }}
                      >
                        ♯
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700">Calidad</label>
                    <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm" value={chordQuality} onChange={(e) => setChordQuality(e.target.value)}>
                      {CHORD_QUALITIES.map((q) => (
                        <option key={q.value} value={q.value}>
                          {q.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700">Estructura</label>
                    <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm" value={chordStructure} onChange={(e) => setChordStructure(e.target.value)}>
                      {CHORD_STRUCTURES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-semibold text-slate-700">Inversión</label>
                    <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm" value={chordInversion} onChange={(e) => setChordInversion(e.target.value)}>
                      {CHORD_INVERSIONS.map((inv) => (
                        <option key={inv.value} value={inv.value}>
                          {inv.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-12">
                    <label className="block text-xs font-semibold text-slate-700">Extensiones</label>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={chordExt7} onChange={(e) => setChordExt7(e.target.checked)} />7
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={chordExt9} disabled={chordStructure !== "chord"} onChange={(e) => setChordExt9(e.target.checked)} />9
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={chordExt11} disabled={chordStructure !== "chord"} onChange={(e) => setChordExt11(e.target.checked)} />11
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={chordExt13} disabled={chordStructure !== "chord"} onChange={(e) => setChordExt13(e.target.checked)} />13
                      </label>
                      {chordDbLastUrl ? (
                        <a className="text-xs text-slate-600 underline" href={chordDbLastUrl} target="_blank" rel="noreferrer">
                          Abrir JSON
                        </a>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">Triada: 1–3–5 · Cuatriada: 1–3–5–7 · Acorde: +9/11/13 (dataset si aplica)</div>
                  </div>

                  <div className="md:col-span-12">
                    <div className="mt-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-800">Voicings</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold shadow-sm hover:bg-slate-50"
                            onClick={() => setChordVoicingIdx((i) => Math.max(0, i - 1))}
                            disabled={chordVoicings.length === 0}
                          >
                            ◀
                          </button>
                          <select
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
                            value={chordVoicingIdx}
                            onChange={(e) => setChordVoicingIdx(parseInt(e.target.value, 10))}
                            disabled={chordVoicings.length === 0}
                          >
                            {chordVoicings.map((v, i) => (
                              <option key={v.frets + i} value={i}>
                                {i + 1}. {v.frets} (span {v.span})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold shadow-sm hover:bg-slate-50"
                            onClick={() => setChordVoicingIdx((i) => Math.min(chordVoicings.length - 1, i + 1))}
                            disabled={chordVoicings.length === 0}
                          >
                            ▶
                          </button>
                        </div>
                      </div>
                      {chordDbError ? <div className="mt-2 text-xs font-semibold text-rose-600">{chordDbError}</div> : null}
                    </div>

                    <div className="mt-3">
                      <ChordFretboard title="Acorde" voicing={activeChordVoicing} voicingIdx={chordVoicingIdx} voicingTotal={chordVoicings.length} />
                    </div>
                  </div>
                </div>

                {/* Acordes cercanos */}
                <div className="mt-6 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Acordes cercanos</div>
                      <div className="text-xs text-slate-600">Selecciona hasta 4 acordes y busca digitaciones dentro de un rango. Ordena por cercanía al Acorde 1.</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-700">Rango</label>
                      <input className="h-10 w-16 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={nearFretFrom} onChange={(e) => setNearFretFrom(parseInt(e.target.value, 10) || 0)} />
                      <span className="text-xs text-slate-600">–</span>
                      <input className="h-10 w-16 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={nearFretTo} onChange={(e) => setNearFretTo(parseInt(e.target.value, 10) || 0)} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {nearSlots.map((slot, idx) => {
                      const isBase = idx === 0;
                      const ranked = nearComputed.ranked[idx]?.ranked || [];
                      const err = nearComputed.ranked[idx]?.err || null;
                      const preferSharpsSlot = preferSharpsFromMajorTonicPc(slot.rootPc);
                      const intervals = buildSlotIntervals(slot);
                      const slotSpelled = spellScaleNotes({ rootPc: slot.rootPc, scaleIntervals: intervals, preferSharps: preferSharpsSlot });

                      return (
                        <div key={idx} className={`rounded-2xl border border-slate-200 p-3 ${slot.enabled ? "bg-white" : "bg-slate-50 opacity-70"}`}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-800">
                              Acorde {idx + 1} {isBase ? "(base)" : ""}
                              <span className="ml-2 text-xs font-normal text-slate-600">(Notas: {slotSpelled.join(", ")})</span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-600">Fondo</span>
                                <input
                                  type="color"
                                  value={nearBgColors[idx] || "#e2e8f0"}
                                  onChange={(e) => setNearBgColor(idx, e.target.value)}
                                  className="h-8 w-10 cursor-pointer rounded-md border border-slate-200 bg-white"
                                  title={`Color fondo Acorde ${idx + 1}`}
                                />
                              </div>

                              {!isBase ? (
                                <label className="inline-flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={!!slot.enabled}
                                    onChange={(e) => {
                                      const on = e.target.checked;
                                      setNearSlots((prev) => {
                                        const next = [...prev];
                                        next[idx] = { ...next[idx], enabled: on };
                                        return next;
                                      });
                                    }}
                                  />
                                  Activo
                                </label>
                              ) : null}
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-12 items-end">
                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-slate-700">Tono</label>
                              <div className="mt-1 flex items-center gap-2">
                                <select
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                  value={slot.rootPc}
                                  disabled={!slot.enabled}
                                  onChange={(e) => {
                                    const pc = parseInt(e.target.value, 10);
                                    setNearSlots((prev) => {
                                      const next = [...prev];
                                      next[idx] = { ...next[idx], rootPc: pc, selFrets: null };
                                      return next;
                                    });
                                  }}
                                >
                                  {NOTES_SHARP.map((n, pc) => (
                                    <option key={pc} value={pc}>
                                      {n}{NOTES_FLAT[pc] !== n ? ` / ${NOTES_FLAT[pc]}` : ""}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-40"
                                  title="Bajar 1 semitono"
                                  disabled={!slot.enabled}
                                  onClick={() => {
                                    setNearSlots((prev) => {
                                      const next = [...prev];
                                      next[idx] = { ...next[idx], rootPc: mod12(next[idx].rootPc - 1), selFrets: null };
                                      return next;
                                    });
                                  }}
                                >
                                  ♭
                                </button>
                                <button
                                  type="button"
                                  className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-40"
                                  title="Subir 1 semitono"
                                  disabled={!slot.enabled}
                                  onClick={() => {
                                    setNearSlots((prev) => {
                                      const next = [...prev];
                                      next[idx] = { ...next[idx], rootPc: mod12(next[idx].rootPc + 1), selFrets: null };
                                      return next;
                                    });
                                  }}
                                >
                                  ♯
                                </button>
                              </div>
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-slate-700">Calidad</label>
                              <select
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                value={slot.quality}
                                disabled={!slot.enabled}
                                onChange={(e) => {
                                  const q = e.target.value;
                                  setNearSlots((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], quality: q, selFrets: null };
                                    return next;
                                  });
                                }}
                              >
                                {CHORD_QUALITIES.map((q) => (
                                  <option key={q.value} value={q.value}>
                                    {q.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-slate-700">Estructura</label>
                              <select
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                value={slot.structure}
                                disabled={!slot.enabled}
                                onChange={(e) => {
                                  const st = e.target.value;
                                  setNearSlots((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], structure: st, ext9: false, ext11: false, ext13: false, selFrets: null };
                                    return next;
                                  });
                                }}
                              >
                                {CHORD_STRUCTURES.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-slate-700">Inversión</label>
                              <select
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                value={slot.inversion}
                                disabled={!slot.enabled}
                                onChange={(e) => {
                                  const inv = e.target.value;
                                  setNearSlots((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], inversion: inv, selFrets: null };
                                    return next;
                                  });
                                }}
                              >
                                {CHORD_INVERSIONS.map((inv) => (
                                  <option key={inv.value} value={inv.value}>
                                    {inv.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-slate-700">Extensiones</label>
                              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                                <label className="inline-flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!slot.ext7}
                                    disabled={!slot.enabled || slot.structure === "tetrad"}
                                    onChange={(e) => {
                                      const on = e.target.checked;
                                      setNearSlots((prev) => {
                                        const next = [...prev];
                                        next[idx] = { ...next[idx], ext7: on, selFrets: null };
                                        return next;
                                      });
                                    }}
                                  />
                                  7
                                </label>
                                <label className="inline-flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!slot.ext9}
                                    disabled={!slot.enabled || slot.structure !== "chord"}
                                    onChange={(e) => {
                                      const on = e.target.checked;
                                      setNearSlots((prev) => {
                                        const next = [...prev];
                                        next[idx] = { ...next[idx], ext9: on, selFrets: null };
                                        return next;
                                      });
                                    }}
                                  />
                                  9
                                </label>
                                <label className="inline-flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!slot.ext11}
                                    disabled={!slot.enabled || slot.structure !== "chord"}
                                    onChange={(e) => {
                                      const on = e.target.checked;
                                      setNearSlots((prev) => {
                                        const next = [...prev];
                                        next[idx] = { ...next[idx], ext11: on, selFrets: null };
                                        return next;
                                      });
                                    }}
                                  />
                                  11
                                </label>
                                <label className="inline-flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!slot.ext13}
                                    disabled={!slot.enabled || slot.structure !== "chord"}
                                    onChange={(e) => {
                                      const on = e.target.checked;
                                      setNearSlots((prev) => {
                                        const next = [...prev];
                                        next[idx] = { ...next[idx], ext13: on, selFrets: null };
                                        return next;
                                      });
                                    }}
                                  />
                                  13
                                </label>
                              </div>
                            </div>

                            <div className="md:col-span-12">
                              <label className="block text-xs font-semibold text-slate-700">Digitación en rango</label>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <select
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 md:w-auto md:flex-1"
                                  disabled={!slot.enabled || !ranked.length}
                                  value={slot.selFrets || ""}
                                  onChange={(e) => {
                                    const f = e.target.value || null;
                                    setNearSlots((prev) => {
                                      const next = [...prev];
                                      next[idx] = { ...next[idx], selFrets: f };
                                      return next;
                                    });
                                  }}
                                >
                                  <option value="">(auto)</option>
                                  {ranked.map((v, i2) => {
                                    const rootName = pcToName(slot.rootPc, preferSharpsSlot);
                                    const bassName = pcToName(v.bassPc ?? slot.rootPc, preferSharpsSlot);
                                    const slash = bassName === rootName ? rootName : `${rootName}/${bassName}`;
                                    const costTxt = !isBase && Number.isFinite(v._cost) ? ` · Δ${v._cost.toFixed(1)}` : "";
                                    return (
                                      <option key={v.frets + i2} value={v.frets}>
                                        {slash} · {v.frets} (span {v.span}){costTxt}
                                      </option>
                                    );
                                  })}
                                </select>

                                <div className="text-xs text-slate-600">
                                  {slot.enabled ? (
                                    err ? (
                                      <span className="font-semibold text-rose-600">{err}</span>
                                    ) : ranked.length ? (
                                      <span>{ranked.length} opciones{isBase ? "" : " (ordenadas por cercanía)"}</span>
                                    ) : (
                                      "Sin opciones"
                                    )
                                  ) : (
                                    "(desactivado)"
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <NearChordsFretboard />
                </div>
              </section>
            ) : null}
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
              <div className="mt-2 text-xs text-slate-600">Patrones disponibles: {patternsMode === "caged" ? "5 CAGED" : scaleIntervals.length === 5 ? "5 boxes" : scaleIntervals.length === 7 ? "7 3NPS" : "(sin patrones)"}.</div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-800">Diagnóstico rápido</div>
              <div className="mt-2 text-xs text-slate-600">Si ves A# en F mayor, pon <b>Notación: Auto</b> o <b>b</b>.</div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
