import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Mástil interactivo
// - Escalas: pentatónicas (mayor/menor), mayor/menor natural, modos
// - Resaltado: raíz, 3ª, 5ª + extras
// - Vista: notas / intervalos
// - Patrones "reales":
//   * Pentatónicas: 5 boxes
//   * Escalas de 7 notas: 3NPS (7 patrones)
// - Ruta "musical": recorre la escala en orden (asc/desc por altura) y se restringe a patrones.
// - Notación: auto #/b según armadura (con override manual)

// ============================================================================
// ÍNDICE RÁPIDO DEL FICHERO
// 1. Catálogos y presets musicales
// 2. Mástil, afinación e inlays
// 3. Utilidades de notación y teoría básica
// 4. Motor de acordes y nomenclatura
// 5. Detección de acordes desde notas seleccionadas
// 6. Patrones, CAGED y cajas pentatónicas
// 7. Ruta musical
// 8. Componente principal
//    8.1 Estado general
//    8.2 Acorde principal
//    8.3 Acordes cercanos
//    8.4 Ruta musical
//    8.5 Persistencia y presets
//    8.6 Cálculos derivados
//    8.7 Componentes UI internos
//    8.8 Render
// ============================================================================

// ============================================================================
// CATÁLOGOS Y PRESETS MUSICALES
// ============================================================================

const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const SCALE_PRESETS = {
  "Pentatónica mayor": [0, 2, 4, 7, 9],
  "Pentatónica menor": [0, 3, 5, 7, 10],

  "Mayor": [0, 2, 4, 5, 7, 9, 11],
  "Menor natural": [0, 2, 3, 5, 7, 8, 10],

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
  "Bebop frigia dominante": [0, 1, 4, 5, 7, 8, 10, 11],
  "Bebop locria": [0, 1, 3, 5, 6, 7, 8, 10],
  "Bebop menor armónica": [0, 2, 3, 5, 7, 8, 10, 11],
  "Bebop menor melódica": [0, 2, 3, 5, 7, 9, 10, 11],

  // Otras útiles
  "Pentatónica menor + blue note": [0, 3, 5, 6, 7, 10],
  "Pentatónica mayor + blue note": [0, 2, 3, 4, 7, 9],
  "Tonos enteros": [0, 2, 4, 6, 8, 10],
  "Disminuida (H-W)": [0, 1, 3, 4, 6, 7, 9, 10],
  "Disminuida (W-H)": [0, 2, 3, 5, 6, 8, 9, 11],

  "Personalizada": null,
};

const SCALE_NAME_ALIASES = {
  "Escala mayor": "Mayor",
  "Escala menor (natural)": "Menor natural",
  "Bebop mixolidia": "Bebop dominante",
  "Bebop menor": "Bebop dórica",
};



const TONALITY_CANDIDATE_SCALE_NAMES = [
  "Mayor",
  "Menor natural",
];

const MANUAL_SCALE_TETRAD_PRESETS = {
  "Pentatónica mayor": [
    { scaleIdx: 0, degreeLabel: "I", suffix: "" },
    { scaleIdx: 1, degreeLabel: "II", suffix: "sus4" },
    { scaleIdx: 2, degreeLabel: "III", suffix: "m(no5)" },
    { scaleIdx: 3, degreeLabel: "V", suffix: "sus2" },
    { scaleIdx: 4, degreeLabel: "VI", suffix: "m" },
  ],
  "Pentatónica menor": [
    { scaleIdx: 0, degreeLabel: "I", suffix: "m" },
    { scaleIdx: 1, degreeLabel: "bIII", suffix: "" },
    { scaleIdx: 2, degreeLabel: "IV", suffix: "sus4" },
    { scaleIdx: 3, degreeLabel: "V", suffix: "m(no5)" },
    { scaleIdx: 4, degreeLabel: "bVII", suffix: "sus2" },
  ],
  "Pentatónica mayor + blue note": [
    { scaleIdx: 0, degreeLabel: "I", suffix: "maj7" },
    { scaleIdx: 1, degreeLabel: "II", suffix: "m7" },
    { scaleIdx: 3, degreeLabel: "III", suffix: "m7" },
    { scaleIdx: 4, degreeLabel: "V", suffix: "7" },
    { scaleIdx: 5, degreeLabel: "VI", suffix: "m7" },
  ],
  "Pentatónica menor + blue note": [
    { scaleIdx: 0, degreeLabel: "I", suffix: "m7" },
    { scaleIdx: 1, degreeLabel: "bIII", suffix: "maj7" },
    { scaleIdx: 2, degreeLabel: "IV", suffix: "m7" },
    { scaleIdx: 4, degreeLabel: "V", suffix: "m7" },
    { scaleIdx: 5, degreeLabel: "bVII", suffix: "7" },
  ],
  "Bebop mayor": [
    { scaleIdx: 0, degreeLabel: "I", suffix: "maj7" },
    { scaleIdx: 1, degreeLabel: "II", suffix: "m7" },
    { scaleIdx: 2, degreeLabel: "III", suffix: "m7" },
    { scaleIdx: 3, degreeLabel: "IV", suffix: "maj7" },
    { scaleIdx: 4, degreeLabel: "V", suffix: "7" },
    { scaleIdx: 6, degreeLabel: "VI", suffix: "m7" },
    { scaleIdx: 7, degreeLabel: "VII", suffix: "m7(b5)" },
  ],
  "Bebop dominante": [
    { scaleIdx: 0, degreeLabel: "I", suffix: "7" },
    { scaleIdx: 1, degreeLabel: "II", suffix: "m7" },
    { scaleIdx: 2, degreeLabel: "III", suffix: "m7(b5)" },
    { scaleIdx: 3, degreeLabel: "IV", suffix: "maj7" },
    { scaleIdx: 4, degreeLabel: "V", suffix: "m7" },
    { scaleIdx: 5, degreeLabel: "VI", suffix: "m7" },
    { scaleIdx: 6, degreeLabel: "bVII", suffix: "maj7" },
  ],
  "Bebop dórica": [
    { scaleIdx: 0, degreeLabel: "I", suffix: "m7" },
    { scaleIdx: 1, degreeLabel: "II", suffix: "m7" },
    { scaleIdx: 2, degreeLabel: "bIII", suffix: "maj7" },
    { scaleIdx: 4, degreeLabel: "IV", suffix: "7" },
    { scaleIdx: 5, degreeLabel: "V", suffix: "m7" },
    { scaleIdx: 6, degreeLabel: "VI", suffix: "m7(b5)" },
    { scaleIdx: 7, degreeLabel: "bVII", suffix: "maj7" },
  ],
  "Húngara menor (Gypsy)": [
    { scaleIdx: 0, degreeLabel: "I", suffix: "m(maj7)" },
    { scaleIdx: 1, degreeLabel: "II", suffix: "7b5" },
    { scaleIdx: 2, degreeLabel: "bIII", suffix: "maj7#5" },
    { scaleIdx: 3, degreeLabel: "#IV", suffix: "dim7" },
    { scaleIdx: 4, degreeLabel: "V", suffix: "maj7" },
    { scaleIdx: 5, degreeLabel: "bVI", suffix: "maj7" },
    { scaleIdx: 6, degreeLabel: "VII", suffix: "m6" },
  ],
  "Doble armónica (Bizantina)": [
    { scaleIdx: 0, degreeLabel: "I", suffix: "maj7" },
    { scaleIdx: 1, degreeLabel: "bII", suffix: "maj7" },
    { scaleIdx: 2, degreeLabel: "III", suffix: "m6" },
    { scaleIdx: 3, degreeLabel: "IV", suffix: "m(maj7)" },
    { scaleIdx: 4, degreeLabel: "V", suffix: "7b5" },
    { scaleIdx: 5, degreeLabel: "bVI", suffix: "maj7#5" },
    { scaleIdx: 6, degreeLabel: "VII", suffix: "(no tert.)" },
  ],
};

// ============================================================================
// MÁSTIL, AFINACIÓN E INLAYS
// ============================================================================

// Afinación estándar (UI: 1ª->6ª)
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

function hasInlayCell(fret, sIdx) {
  return (INLAY_SINGLE.has(fret) && sIdx === 2) || (INLAY_DOUBLE.has(fret) && (sIdx === 1 || sIdx === 3));
}

const KING_BOX_DEFAULTS = {
  bb: { label: "B.B. King", border: "#000000" },
  albert: { label: "Albert King", border: "#7c3aed" },
};

const BB_KING_BOX_OFFSETS = [
  { sIdx: 2, fretOffset: 1 },
  { sIdx: 1, fretOffset: 0 },
  { sIdx: 1, fretOffset: 2 },
  { sIdx: 0, fretOffset: 0 },
  { sIdx: 0, fretOffset: 1 },
  { sIdx: 0, fretOffset: 2 },
];

const ALBERT_KING_BOX_OFFSETS = [
  { sIdx: 2, fretOffset: -1 },
  { sIdx: 1, fretOffset: -2 },
  { sIdx: 1, fretOffset: 0 },
  { sIdx: 0, fretOffset: -2 },
  { sIdx: 0, fretOffset: 0 },
];

function buildKingBoxInstancesFromOffsets({ rootPc, maxFret, anchorSIdx, offsets }) {
  const roots = findRootFretsOnString({ rootPc, sIdx: anchorSIdx, maxFret });
  const out = [];
  const seen = new Set();

  for (const rootFret of roots) {
    const cells = new Set();
    for (const item of offsets) {
      const fret = rootFret + item.fretOffset;
      if (fret < 0 || fret > maxFret) continue;
      cells.add(`${item.sIdx}:${fret}`);
    }
    if (!cells.size) continue;
    const key = Array.from(cells).sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ rootFret, cells });
  }

  return out;
}

function buildBbKingBoxInstances({ rootPc, maxFret }) {
  return buildKingBoxInstancesFromOffsets({
    rootPc,
    maxFret,
    anchorSIdx: 1,
    offsets: BB_KING_BOX_OFFSETS,
  });
}

function buildAlbertKingBoxInstances({ rootPc, maxFret }) {
  return buildKingBoxInstancesFromOffsets({
    rootPc,
    maxFret,
    anchorSIdx: 1,
    offsets: ALBERT_KING_BOX_OFFSETS,
  });
}

function buildKingBoxOverlayMap({ enabled, mode, rootPc, maxFret }) {
  const map = new Map();
  if (!enabled) return map;

  const addTag = (tag, instances) => {
    for (const inst of instances) {
      for (const cell of inst.cells) {
        if (!map.has(cell)) map.set(cell, new Set());
        map.get(cell).add(tag);
      }
    }
  };

  if (mode === "bb" || mode === "both") {
    addTag("bb", buildBbKingBoxInstances({ rootPc, maxFret }));
  }
  if (mode === "albert" || mode === "both") {
    addTag("albert", buildAlbertKingBoxInstances({ rootPc, maxFret }));
  }

  return map;
}

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NATURAL_PCS = new Set(Object.values(NATURAL_PC));
const IONIAN_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

// ============================================================================
// UTILIDADES DE NOTACIÓN Y TEORÍA BÁSICA
// ============================================================================

function mod12(n) {
  const x = n % 12;
  return x < 0 ? x + 12 : x;
}

function pcToName(pc, preferSharps) {
  const list = preferSharps ? NOTES_SHARP : NOTES_FLAT;
  return list[mod12(pc)];
}

function pcToDualName(pc) {
  const p = mod12(pc);
  const sharp = NOTES_SHARP[p];
  const flat = NOTES_FLAT[p];
  return sharp === flat ? sharp : `${sharp}/${flat}`;
}

// ------------------------
// Acordes UI: selector de Tono por letra + b/# (sin C#/Db en el combo)
// - El combo muestra solo C D E F G A B.
// - Los botones b/# desplazan 1 semitono y fijan la “ortografía” (C# vs Db).
// ------------------------
const BLACK_PC_TO_LETTER_SHARP = { 1: "C", 3: "D", 6: "F", 8: "G", 10: "A" };
const BLACK_PC_TO_LETTER_FLAT = { 1: "D", 3: "E", 6: "G", 8: "A", 10: "B" };

function chordUiLetterFromPc(pc, preferSharps) {
  const p = mod12(pc);
  for (const [l, v] of Object.entries(NATURAL_PC)) {
    if (v === p) return l;
  }
  return preferSharps ? (BLACK_PC_TO_LETTER_SHARP[p] || "C") : (BLACK_PC_TO_LETTER_FLAT[p] || "D");
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

function intervalToSimpleChordDegreeToken(semi) {
  const map = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "#5", "6", "b7", "7"];
  return map[mod12(semi)];
}

// ============================================================================
// MOTOR DE ACORDES Y NOMENCLATURA
// ============================================================================

// ------------------------
// Acordes
// ------------------------

// --------------------------------------------------------------------------
// BLOQUE: DATASET / JSON DE DIGITACIONES
// --------------------------------------------------------------------------

// Dataset de digitaciones (voicings) para NO inventar acordes:
// https://github.com/szaza/guitar-chords-db-json (MIT)
// Nota: las carpetas del dataset van por notas con sostenidos (C#, D#, F#, G#, A#), no bemoles.
function chordDbKeyNameFromPc(pc) {
  return NOTES_SHARP[mod12(pc)];
}

function chordSuffixFromUI({ quality, suspension = "none", structure, ext7, ext6, ext9, ext11, ext13 }) {
  const sus = suspension || "none";
  const isSus = sus !== "none";
  const q = quality;
  const isMajLike = q === "maj" || q === "dom";
  const isMin = q === "min";

  // Normaliza combinaciones raras: sus + dim/ø no es habitual.
  const q2 = isSus && (q === "dim" || q === "hdim") ? "maj" : q;

  // TRIADAS
  if (structure === "triad") {
    if (isSus) {
      if (ext7) {
        if (q2 === "dom") return sus === "sus4" ? "7sus4" : "7sus2";
        if (q2 === "maj") return sus === "sus4" ? "maj7sus4" : "maj7sus2";
        return sus === "sus4" ? "m7sus4" : "m7sus2";
      }
      if (ext6) return sus === "sus4" ? "sus4add6" : "sus2add6";
      return sus === "sus4" ? "sus4" : "sus2";
    }

    if (ext6 && !ext7) return isMin ? "m6" : "6";
    if (isMajLike) return "major";
    if (isMin) return "minor";
    return "dim";
  }

  // CUATRIADAS
  if (structure === "tetrad") {
    const addCount = (ext6 ? 1 : 0) + (ext9 ? 1 : 0) + (ext11 ? 1 : 0) + (ext13 ? 1 : 0);

    // add6/add9/add11/add13 (sin 7ª)
    if (!ext7 && addCount === 1) {
      if (ext6) return isMin ? "m6" : "6";
      if (ext13) return isMin ? "m(add13)" : "add13";
      if (ext11) return isMin ? "m(add11)" : "add11";
      if (ext9) return isMin ? "m(add9)" : "add9";
    }

    if (isSus) {
      if (q2 === "dom") return sus === "sus4" ? "7sus4" : "7sus2";
      if (q2 === "maj") return sus === "sus4" ? "maj7sus4" : "maj7sus2";
      return sus === "sus4" ? "m7sus4" : "m7sus2";
    }

    if (q2 === "maj") return "maj7";
    if (q2 === "dom") return "7";
    if (q2 === "min") return "m7";
    if (q2 === "hdim") return "m7b5";
    return "dim7";
  }

  // ACORDES (con extensiones)
  if (q2 === "hdim") return "m7b5";

  if (isSus) {
    if (ext7) {
      if (q2 === "dom") return sus === "sus4" ? "7sus4" : "7sus2";
      if (q2 === "maj") return sus === "sus4" ? "maj7sus4" : "maj7sus2";
      if (q2 === "min") return sus === "sus4" ? "m7sus4" : "m7sus2";
    }
    if (ext6 && !ext7 && !ext9 && !ext11 && !ext13) return isMin ? "m6" : "6";
    return sus === "sus4" ? "sus4" : "sus2";
  }

  // add6 puro (sin 7/9/11/13)
  if (ext6 && !ext7 && !ext9 && !ext11 && !ext13) return isMin ? "m6" : "6";

  if (q2 === "dim") {
    if (ext13 || ext11 || ext9 || ext7) return "dim7";
    return "dim";
  }

  // Dominantes
  if (q2 === "dom") {
    // Sin 7ª, un “dominante” deja de ser dominante: lo nombramos como mayor/add*.
    if (!ext7) {
      if (ext13) return "add13";
      if (ext11) return "add11";
      if (ext9) return "add9";
      if (ext6) return "6";
      return "major";
    }
    if (ext13) return "13";
    if (ext11) return "11";
    if (ext9) return "9";
    return "7";
  }

  // Maj / min
  if (q2 === "maj") {
    if (ext13) return ext7 ? "maj13" : "add13";
    if (ext11) return ext7 ? "maj11" : "add11";
    if (ext9) return ext7 ? "maj9" : "add9";
    if (ext7) return "maj7";
    if (ext6) return "6";
    return "major";
  }

  if (q2 === "min") {
    if (ext13) return ext7 ? "m13" : "m(add13)";
    if (ext11) return ext7 ? "m11" : "m(add11)";
    if (ext9) return ext7 ? "m9" : "m(add9)";
    if (ext7) return "m7";
    if (ext6) return "m6";
    return "minor";
  }

  return "major";
}

// Nombre legible del acorde a partir de la selección actual (sin inventar digitaciones).
const CHORD_SUFFIX_DISPLAY = {
  major: "",
  minor: "m",
  dim: "dim",
  maj7: "maj7",
  "7": "7",
  m7: "m7",
  m7b5: "m7(b5)",
  dim7: "dim7",

  // 6 / add6 (estándar)
  "6": "6",
  m6: "m6",

  // sus
  sus2: "sus2",
  sus4: "sus4",
  "7sus2": "7sus2",
  "7sus4": "7sus4",
  maj7sus2: "maj7sus2",
  maj7sus4: "maj7sus4",
  m7sus2: "m7sus2",
  m7sus4: "m7sus4",
  sus2add6: "sus2(add6)",
  sus4add6: "sus4(add6)",

  // add*
  add9: "add9",
  add11: "add11",
  add13: "add13",
  "m(add9)": "m(add9)",
  "m(add11)": "m(add11)",
  "m(add13)": "m(add13)",
  sus2add9: "sus2add9",
  sus4add9: "sus4add9",
  sus2add11: "sus2add11",
  sus4add11: "sus4add11",
  sus2add13: "sus2add13",
  sus4add13: "sus4add13",

  maj9: "maj9",
  m9: "m9",
  "9": "9",
  "11": "11",
  "13": "13",
  maj11: "maj11",
  m11: "m11",
  maj13: "maj13",
  m13: "m13",
};

function chordEffectiveStructureForName(structure, ext7, ext6, suspension) {
  // Si el usuario marca 7 en “Triada”, en la práctica es una cuatriada.
  // Si marca 6 en “Triada”, solo lo tratamos como "6" (cuatriada) cuando NO hay suspensión.
  // Ej: Csus2 + 6 debe mostrarse como Csus2(add6), no como C6.
  const sus = suspension || "none";
  const isSus = sus !== "none";

  if (structure === "triad" && ext7) return "tetrad";
  if (structure === "triad" && ext6 && !isSus) return "tetrad";
  return structure;
}

function chordDisplayNameFromUI({ rootPc, preferSharps, quality, suspension = "none", structure, ext7, ext6, ext9, ext11, ext13 }) {
  const rootName = pcToName(mod12(rootPc), !!preferSharps);
  const effStructure = chordEffectiveStructureForName(structure, !!ext7, !!ext6, suspension);

  if (isMultiAddChordSelection({ ext7: !!ext7, ext6: !!ext6, ext9: !!ext9, ext11: !!ext11, ext13: !!ext13 })) {
    return `${rootName}${buildMultiAddDisplaySuffix({ quality, suspension, ext6: !!ext6, ext9: !!ext9, ext11: !!ext11, ext13: !!ext13 })}`;
  }

  let suf = chordSuffixFromUI({
    quality,
    suspension,
    structure: effStructure,
    ext7: !!ext7,
    ext6: !!ext6,
    ext9: !!ext9,
    ext11: !!ext11,
    ext13: !!ext13,
  });

  if (effStructure === "triad" && quality === "dom" && !ext7) suf = "major";

  let disp = "";
  if (suf && CHORD_SUFFIX_DISPLAY[suf] != null) disp = CHORD_SUFFIX_DISPLAY[suf];
  else if (typeof suf === "string" && suf.startsWith("m(")) disp = suf;
  else if (typeof suf === "string") disp = suf;

  return `${rootName}${disp}`;
}

function chordDisplaySuffixOnly({ quality, suspension = "none", structure, ext7, ext6, ext9, ext11, ext13 }) {
  const effStructure = chordEffectiveStructureForName(structure, !!ext7, !!ext6, suspension);

  if (isMultiAddChordSelection({ ext7: !!ext7, ext6: !!ext6, ext9: !!ext9, ext11: !!ext11, ext13: !!ext13 })) {
    return buildMultiAddDisplaySuffix({ quality, suspension, ext6: !!ext6, ext9: !!ext9, ext11: !!ext11, ext13: !!ext13 });
  }

  let suf = chordSuffixFromUI({
    quality,
    suspension,
    structure: effStructure,
    ext7: !!ext7,
    ext6: !!ext6,
    ext9: !!ext9,
    ext11: !!ext11,
    ext13: !!ext13,
  });

  if (effStructure === "triad" && quality === "dom" && !ext7) suf = "major";

  if (suf && CHORD_SUFFIX_DISPLAY[suf] != null) return CHORD_SUFFIX_DISPLAY[suf];
  if (typeof suf === "string") return suf;
  return "";
}

function detectSupportedTriadQuality(thirdOffset, fifthOffset) {
  const t = mod12(thirdOffset);
  const f = mod12(fifthOffset);
  if (t === 4 && f === 7) return "maj";
  if (t === 3 && f === 7) return "min";
  if (t === 3 && f === 6) return "dim";
  return null;
}

function detectSupportedTetradQuality(thirdOffset, fifthOffset, seventhOffset) {
  const t = mod12(thirdOffset);
  const f = mod12(fifthOffset);
  const s = mod12(seventhOffset);
  if (t === 4 && f === 7 && s === 11) return "maj";
  if (t === 4 && f === 7 && s === 10) return "dom";
  if (t === 3 && f === 7 && s === 10) return "min";
  if (t === 3 && f === 6 && s === 10) return "hdim";
  if (t === 3 && f === 6 && s === 9) return "dim";
  return null;
}

function buildScaleDegreeChord({ scaleIntervals, degreeIndex, withSeventh = false }) {
  const n = scaleIntervals.length;
  if (n < (withSeventh ? 4 : 3)) return null;

  const rootOffset = mod12(scaleIntervals[degreeIndex % n]);
  const thirdOffset = mod12(scaleIntervals[(degreeIndex + 2) % n] - rootOffset);
  const fifthOffset = mod12(scaleIntervals[(degreeIndex + 4) % n] - rootOffset);

  if (withSeventh) {
    const seventhOffset = mod12(scaleIntervals[(degreeIndex + 6) % n] - rootOffset);
    const quality = detectSupportedTetradQuality(thirdOffset, fifthOffset, seventhOffset);
    if (!quality) return null;
    return {
      rootOffset,
      quality,
      suspension: "none",
      structure: "tetrad",
      inversion: "all",
      form: "open",
      ext7: true,
      ext6: false,
      ext9: false,
      ext11: false,
      ext13: false,
    };
  }

  const quality = detectSupportedTriadQuality(thirdOffset, fifthOffset);
  if (!quality) return null;
  return {
    rootOffset,
    quality,
    suspension: "none",
    structure: "triad",
    inversion: "all",
    form: "open",
    ext7: false,
    ext6: false,
    ext9: false,
    ext11: false,
    ext13: false,
  };
}

function isMinorHarmonyScaleName(scaleName) {
  const n = normalizeScaleName(scaleName);
  return [
    "Menor natural",
    "Menor armónica",
    "Menor melódica (asc)",
    "Eólica (Aeolian)",
  ].includes(n);
}

function buildHarmonyDegreeChord({ scaleName, harmonyMode, scaleIntervals, degreeIndex, withSeventh = false }) {
  const built = buildScaleDegreeChord({ scaleIntervals, degreeIndex, withSeventh });
  const normalized = normalizeScaleName(scaleName);

  if (
    harmonyMode === "functional_minor" &&
    isMinorHarmonyScaleName(normalized) &&
    scaleIntervals.length >= 7 &&
    degreeIndex === 4
  ) {
    const rootOffset = mod12(scaleIntervals[degreeIndex % scaleIntervals.length]);
    if (withSeventh) {
      return {
        rootOffset,
        quality: "dom",
        suspension: "none",
        structure: "tetrad",
        inversion: "root",
        form: "closed",
        ext7: true,
        ext6: false,
        ext9: false,
        ext11: false,
        ext13: false,
      };
    }
    return {
      rootOffset,
      quality: "maj",
      suspension: "none",
      structure: "triad",
      inversion: "root",
      form: "open",
      positionForm: "open",
      ext7: false,
      ext6: false,
      ext9: false,
      ext11: false,
      ext13: false,
    };
  }

  return built;
}

const ROMAN_DEGREES = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

function romanizeDegreeNumber(n) {
  return ROMAN_DEGREES[n - 1] || String(n);
}

function romanDegreeFromInterval(interval) {
  const tok = intervalToDegreeToken(interval);
  const accidental = tok.replace(/[0-9]/g, "");
  const num = parseInt(tok.replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(num)) return tok;
  return `${accidental}${romanizeDegreeNumber(num)}`;
}

function tetradSuffixFromOffsets(thirdOffset, fifthOffset, seventhOffset) {
  const t = mod12(thirdOffset);
  const f = mod12(fifthOffset);
  const s = mod12(seventhOffset);
  if (t === 4 && f === 7 && s === 11) return "maj7";
  if (t === 4 && f === 7 && s === 10) return "7";
  if (t === 3 && f === 7 && s === 10) return "m7";
  if (t === 3 && f === 7 && s === 11) return "m(maj7)";
  if (t === 3 && f === 6 && s === 10) return "m7(b5)";
  if (t === 3 && f === 6 && s === 9) return "dim7";
  if (t === 4 && f === 8 && s === 11) return "maj7#5";
  if (t === 4 && f === 8 && s === 10) return "7#5";
  if (t === 4 && f === 6 && s === 10) return "7b5";
  return "?";
}

function buildScaleTetradHarmonization({ rootPc, scaleName, harmonyMode, scaleIntervals, spelledScaleNotes, preferSharps }) {
  const normalized = normalizeScaleName(scaleName);
  const n = scaleIntervals.length;
  if (n < 4) return [];

  const manualPreset = MANUAL_SCALE_TETRAD_PRESETS[normalized];
  if (manualPreset && manualPreset.length) {
    return manualPreset.map((item) => {
      const noteRoot = spelledScaleNotes[item.scaleIdx] || pcToName(mod12(rootPc + scaleIntervals[item.scaleIdx]), preferSharps);
      return {
        degreeName: `${item.degreeLabel}${item.suffix}`,
        noteName: `${noteRoot}${item.suffix}`,
      };
    });
  }

  return scaleIntervals.map((rootOffset, i) => {
    const functionalMinorDominant =
      harmonyMode === "functional_minor" &&
      isMinorHarmonyScaleName(normalized) &&
      n >= 7 &&
      i === 4;

    const thirdOffset = mod12(scaleIntervals[(i + 2) % n] - rootOffset);
    const fifthOffset = mod12(scaleIntervals[(i + 4) % n] - rootOffset);
    const seventhOffset = mod12(scaleIntervals[(i + 6) % n] - rootOffset);
    const suffix = functionalMinorDominant ? "7" : tetradSuffixFromOffsets(thirdOffset, fifthOffset, seventhOffset);
    const degreeBase = romanDegreeFromInterval(rootOffset);
    const degreeName = `${degreeBase}${suffix}`;
    const noteRoot = spelledScaleNotes[i] || pcToName(mod12(rootPc + rootOffset), preferSharps);

    return {
      degreeName,
      noteName: `${noteRoot}${suffix}`,
    };
  });
}

function slotChordTonalitySignature(slot) {
  if (!slot) return null;
  return {
    rootPc: mod12(slot.rootPc),
    suffix: chordDisplaySuffixOnly({
      quality: slot.quality,
      suspension: slot.suspension || "none",
      structure: slot.structure,
      ext7: !!slot.ext7,
      ext6: !!slot.ext6,
      ext9: !!slot.ext9,
      ext11: !!slot.ext11,
      ext13: !!slot.ext13,
    }),
  };
}

function buildTonalityDegreeCandidate({ tonicPc, scaleName, harmonyMode, degreeIndex, withSeventh }) {
  const scaleIntervals = buildScaleIntervals(scaleName, "", tonicPc);
  const preferSharps = computeAutoPreferSharps({ rootPc: tonicPc, scaleName });
  const built = buildHarmonyDegreeChord({ scaleName, harmonyMode, scaleIntervals, degreeIndex, withSeventh });
  if (!built) return null;

  const rootPc = mod12(tonicPc + built.rootOffset);
  const noteName = pcToName(rootPc, preferSharps);
  const suffix = chordDisplaySuffixOnly({
    quality: built.quality,
    suspension: built.suspension,
    structure: built.structure,
    ext7: built.ext7,
    ext6: built.ext6,
    ext9: built.ext9,
    ext11: built.ext11,
    ext13: built.ext13,
  });

  return {
    rootPc,
    suffix,
    degreeIndex,
    degreeLabel: ROMAN_DEGREES[degreeIndex] || String(degreeIndex + 1),
    noteLabel: `${noteName}${suffix}`,
  };
}

function formatTonalityLabel(scaleName, tonicPc) {
  const preferSharps = computeAutoPreferSharps({ rootPc: tonicPc, scaleName });
  const tonicName = pcToName(tonicPc, preferSharps);
  if (scaleName === "Mayor") return `${tonicName} mayor`;
  if (scaleName === "Menor natural") return `${tonicName} menor`;
  return `${tonicName} ${scaleName}`;
}

function analyzeChordSetTonality({ slots, harmonyMode }) {
  const selected = (slots || []).filter((s) => !!s?.enabled);
  if (!selected.length) return { selectedNames: [], labels: [], text: "(ninguna)" };

  const selectedNames = selected.map((slot) => chordDisplayNameFromUI({
    rootPc: slot.rootPc,
    preferSharps: slot.spellPreferSharps ?? preferSharpsFromMajorTonicPc(mod12(slot.rootPc)),
    quality: slot.quality,
    suspension: slot.suspension || "none",
    structure: slot.structure,
    ext7: !!slot.ext7,
    ext6: !!slot.ext6,
    ext9: !!slot.ext9,
    ext11: !!slot.ext11,
    ext13: !!slot.ext13,
  }));

  const results = [];

  for (const scaleName of TONALITY_CANDIDATE_SCALE_NAMES) {
    for (let tonicPc = 0; tonicPc < 12; tonicPc++) {
      let ok = true;

      for (const slot of selected) {
        const target = slotChordTonalitySignature(slot);
        const withSeventh = slot.structure === "tetrad" || !!slot.ext7;
        let found = false;

        for (let degreeIndex = 0; degreeIndex < 7; degreeIndex++) {
          const cand = buildTonalityDegreeCandidate({ tonicPc, scaleName, harmonyMode, degreeIndex, withSeventh });
          if (!cand) continue;
          if (cand.rootPc === target.rootPc && cand.suffix === target.suffix) {
            found = true;
            break;
          }
        }

        if (!found) {
          ok = false;
          break;
        }
      }

      if (ok) results.push(formatTonalityLabel(scaleName, tonicPc));
    }
  }

  const labels = Array.from(new Set(results));
  return {
    selectedNames,
    labels,
    text: labels.length ? labels.join(" · ") : "No clara con los acordes seleccionados",
  };
}

// Base del sitio (Vite) para que fetch a /public funcione en localhost y GitHub Pages.
// En producción (Pages) suele ser "/mastil_pruebas/" y en dev "/".
// OJO: nunca accedas a import.meta.env.BASE_URL sin optional chaining.
// En Vite existe import.meta.env.BASE_URL ("/" en dev, "/<repo>/" en GitHub Pages).
// Evitamos sintaxis TS "as any" porque puede romper el parser en algunos entornos.
const APP_BASE = (import.meta && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : "/";
// Fallback (cuando se ejecuta fuera del repo, p.ej. sandbox): GitHub Pages del proyecto
const PAGES_BASE = "https://a01653.github.io/mastil_pruebas/";
const UI_STORAGE_KEY = "mastil_interactivo_guitarra_config_v1";
const UI_PRESETS_STORAGE_KEY = "mastil_interactivo_guitarra_presets_v1";
const UI_STATUS_SESSION_KEY = "mastil_interactivo_guitarra_status_v1";
const QUICK_PRESET_COUNT = 3;
const UI_CONFIG_VERSION = 1;
const APP_VERSION = "2.98";

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
  const mutedSIdx = [];
  for (let i = 0; i < 6; i++) {
    const fret = fretsLH[i];
    const sIdx = 5 - i;
    if (fret == null) {
      mutedSIdx.push(sIdx);
      continue;
    }
    if (fret < 0 || fret > maxFret) return null;
    const pc = mod12(STRINGS[sIdx].pc + fret);
    notes.push({ sIdx, fret, pc });
  }
  if (notes.length < 3) return null;

  // Bajo real (nota más grave)
  let bass = notes[0];
  for (const n of notes) {
    if (pitchAt(n.sIdx, n.fret) < pitchAt(bass.sIdx, bass.fret)) bass = n;
  }

  const frettedNotes = notes.filter((n) => n.fret > 0);
  const rangeNotes = frettedNotes.length ? frettedNotes : notes;
  const minFret = Math.min(...rangeNotes.map((n) => n.fret));
  const maxF = Math.max(...rangeNotes.map((n) => n.fret));
  const span = maxF - minFret;
  const reach = maxF - minFret + 1;
  const absoluteMinFret = Math.min(...notes.map((n) => n.fret));
  const absoluteMaxFret = Math.max(...notes.map((n) => n.fret));

  return {
    frets: fretsToChordDbString(fretsLH),
    notes,
    mutedSIdx,
    bassKey: `${bass.sIdx}:${bass.fret}`,
    bassPc: bass.pc,
    minFret,
    maxFret: maxF,
    span,
    reach,
    pitchSpan: Math.max(...notes.map((n) => pitchAt(n.sIdx, n.fret))) - Math.min(...notes.map((n) => pitchAt(n.sIdx, n.fret))),
    absoluteMinFret,
    absoluteMaxFret,
    relIntervals: new Set(notes.map((n) => mod12(n.pc - rootPc))),
  };
}

function frettedSpanFromFrets(frets) {
  const arr = Array.isArray(frets) ? frets.filter((f) => Number.isFinite(f) && f >= 0) : [];
  const fretted = arr.filter((f) => f > 0);
  const ref = fretted.length ? fretted : arr;
  if (!ref.length) return 0;
  return Math.max(...ref) - Math.min(...ref);
}

function isErgonomicVoicing(v, maxReachLimit = 4) {
  if (!v?.notes?.length) return false;

  const fretted = v.notes.filter((n) => n.fret > 0);
  const frets = fretted.map((n) => n.fret).sort((a, b) => a - b);
  const reach = frets.length
    ? (frets[frets.length - 1] - frets[0] + 1)
    : (v.reach ?? ((v.maxFret - v.minFret) + 1));

  // Distancia real entre notas pisadas. Las cuerdas al aire no deben inflar el alcance.
  if (reach > maxReachLimit) return false;

  // Evita huecos muy grandes entre dedos.
  for (let i = 1; i < frets.length; i++) {
    if (frets[i] - frets[i - 1] > 3) return false;
  }

  return true;
}

// --------------------------------------------------------------------------
// BLOQUE: GENERADORES DE VOICINGS
// --------------------------------------------------------------------------

function generateTriadVoicings({ rootPc, thirdOffset, fifthOffset, inversion, maxFret, maxSpan = 4 }) {
  const targets = [0, thirdOffset, fifthOffset].map((x) => mod12(rootPc + x));

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

      const fa = fretsForPcOnString(sA, targets[perm[0]], maxFret);
      const fb = fretsForPcOnString(sB, targets[perm[1]], maxFret);
      const fc = fretsForPcOnString(sC, targets[perm[2]], maxFret);

      for (const f1 of fa) {
        for (const f2 of fb) {
          for (const f3 of fc) {
            const span = frettedSpanFromFrets([f1, f2, f3]);
            if (span > maxSpan) continue;

            // Construye fretsLH: LowE..HighE
            const fretsLH = [null, null, null, null, null, null];
            // set: indices UI 0..5. LH index = 5 - sIdx
            fretsLH[5 - sA] = f1;
            fretsLH[5 - sB] = f2;
            fretsLH[5 - sC] = f3;

            const v = buildVoicingFromFretsLH({ fretsLH, rootPc, maxFret });
            if (!v || !isErgonomicVoicing(v, maxSpan)) continue;

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
      const pcs = [targets[perm[0]], targets[perm[1]], targets[perm[2]], targets[perm[3]]];
      const fretsList = pcs.map((pc, idx) => fretsForPcOnString(set[idx], pc, maxFret));

      for (const f1 of fretsList[0]) {
        for (const f2 of fretsList[1]) {
          for (const f3 of fretsList[2]) {
            for (const f4 of fretsList[3]) {
              const span = frettedSpanFromFrets([f1, f2, f3, f4]);
              if (span > maxSpan) continue;

              const fretsLH = [null, null, null, null, null, null];
              fretsLH[5 - set[0]] = f1;
              fretsLH[5 - set[1]] = f2;
              fretsLH[5 - set[2]] = f3;
              fretsLH[5 - set[3]] = f4;

              const v = buildVoicingFromFretsLH({ fretsLH, rootPc, maxFret });
              if (!v || !isErgonomicVoicing(v, maxSpan)) continue;
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

function chordToneFretsOnStringInWindow({ sIdx, rootPc, allowedIntervals, nearFrom, nearTo }) {
  const out = [];
  const openInterval = mod12(STRINGS[sIdx].pc - rootPc);
  if (allowedIntervals.has(openInterval)) out.push(0);
  for (let fret = nearFrom; fret <= nearTo; fret++) {
    const interval = mod12(STRINGS[sIdx].pc + fret - rootPc);
    if (allowedIntervals.has(interval)) out.push(fret);
  }
  return Array.from(new Set(out));
}

function augmentVoicingsWithChordToneDuplicatesInWindow({ voicings, rootPc, allowedIntervals, requiredIntervals, allowedBassIntervals, nearFrom, nearTo, maxFret, maxSpan }) {
  const baseList = Array.isArray(voicings) ? voicings : [];
  const out = [];
  const seen = new Set();
  const mustHave = requiredIntervals instanceof Set ? requiredIntervals : new Set(Array.from(allowedIntervals || []).map(mod12));

  const pushVoicing = (v) => {
    if (!v?.frets) return;
    if (seen.has(v.frets)) return;
    seen.add(v.frets);
    out.push(v);
  };

  baseList.forEach(pushVoicing);

  for (const base of baseList) {
    const baseFretsLH = parseChordDbFretsString(base?.frets);
    if (!baseFretsLH) continue;

    const fretted = (base.notes || []).filter((n) => n.fret > 0);
    const center = fretted.length ? fretted.reduce((acc, n) => acc + n.fret, 0) / fretted.length : nearFrom;

    const stringDefs = Array.from({ length: 6 }, (_, sIdx) => {
      const baseFret = baseFretsLH[5 - sIdx];
      const ranked = chordToneFretsOnStringInWindow({ sIdx, rootPc, allowedIntervals, nearFrom, nearTo })
        .sort((a, b) => {
          const scoreA = a === 0 ? -100 : Math.abs(a - center);
          const scoreB = b === 0 ? -100 : Math.abs(b - center);
          return scoreA - scoreB || a - b;
        })
        .slice(0, 4);

      const alts = [];
      const addAlt = (fret) => {
        if (fret === baseFret) return;
        if (alts.includes(fret)) return;
        alts.push(fret);
      };

      if (baseFret == null) {
        ranked.forEach(addAlt);
      } else {
        if (ranked.includes(0) && baseFret !== 0) addAlt(0);
        if (sIdx === 0 || sIdx === 5) addAlt(null);
      }

      return { sIdx, alts };
    }).filter((x) => x.alts.length);

    if (!stringDefs.length) continue;

    const rec = (idx, fretsLH, changedCount) => {
      if (idx >= stringDefs.length) {
        if (changedCount === 0) return;
        const v = buildVoicingFromFretsLH({ fretsLH, rootPc, maxFret });
        if (!v || !isErgonomicVoicing(v, maxSpan)) return;
        if (!v.notes.every((n) => n.fret === 0 || (n.fret >= nearFrom && n.fret <= nearTo))) return;

        const rel = new Set((v.notes || []).map((n) => mod12(n.pc - rootPc)));
        for (const intv of rel) {
          if (!allowedIntervals.has(intv)) return;
        }
        for (const intv of mustHave) {
          if (!rel.has(intv)) return;
        }

        const bassInt = mod12(v.bassPc - rootPc);
        if (Array.isArray(allowedBassIntervals) && allowedBassIntervals.length && !allowedBassIntervals.includes(bassInt)) return;

        pushVoicing({
          ...v,
          _form: base?._form,
          _sourceRootPc: base?._sourceRootPc,
        });
        return;
      }

      rec(idx + 1, fretsLH, changedCount);
      if (changedCount >= 2) return;

      const { sIdx, alts } = stringDefs[idx];
      for (const fret of alts) {
        const next = [...fretsLH];
        next[5 - sIdx] = fret;
        rec(idx + 1, next, changedCount + 1);
      }
    };

    rec(0, [...baseFretsLH], 0);
  }

  return out.sort((a, b) => (a.minFret - b.minFret) || (a.span - b.span) || (a.maxFret - b.maxFret) || a.frets.localeCompare(b.frets));
}

function augmentExactVoicingsWithOpenSubstitutions({ voicings, rootPc, allowedIntervals, requiredIntervals, allowedBassIntervals, nearFrom, nearTo, maxFret, maxSpan, exactNoteCount }) {
  const baseList = Array.isArray(voicings) ? voicings : [];
  const out = [];
  const seen = new Set();
  const mustHave = requiredIntervals instanceof Set ? requiredIntervals : new Set(Array.from(allowedIntervals || []).map(mod12));

  const pushBuiltIfValid = (fretsLH, baseMeta = null) => {
    if (!Array.isArray(fretsLH)) return;
    const v = buildVoicingFromFretsLH({ fretsLH, rootPc, maxFret });
    if (!v || !isErgonomicVoicing(v, maxSpan)) return;
    if (!v.notes.every((n) => n.fret === 0 || (n.fret >= nearFrom && n.fret <= nearTo))) return;
    if (v.notes.length !== exactNoteCount) return;

    const rel = new Set((v.notes || []).map((n) => mod12(n.pc - rootPc)));
    for (const intv of rel) {
      if (!allowedIntervals.has(intv)) return;
    }
    for (const intv of mustHave) {
      if (!rel.has(intv)) return;
    }

    const bassInt = mod12(v.bassPc - rootPc);
    if (Array.isArray(allowedBassIntervals) && allowedBassIntervals.length && !allowedBassIntervals.includes(bassInt)) return;

    if (seen.has(v.frets)) return;
    seen.add(v.frets);
    out.push({
      ...v,
      _form: baseMeta?._form,
      _sourceRootPc: baseMeta?._sourceRootPc,
    });
  };

  baseList.forEach((v) => {
    if (!v?.frets) return;
    if (seen.has(v.frets)) return;
    seen.add(v.frets);
    out.push(v);
  });

  for (const base of baseList) {
    const baseFretsLH = parseChordDbFretsString(base?.frets);
    if (!baseFretsLH) continue;

    const openEligibleLhIdx = Array.from({ length: 6 }, (_, lhIdx) => {
      const sIdx = 5 - lhIdx;
      return allowedIntervals.has(mod12(STRINGS[sIdx].pc - rootPc));
    });

    const usedIdx = baseFretsLH.map((f, lhIdx) => ({ lhIdx, fret: f })).filter((x) => x.fret != null);
    const mutedIdx = baseFretsLH.map((f, lhIdx) => ({ lhIdx, fret: f })).filter((x) => x.fret == null);

    for (const item of usedIdx) {
      if (item.fret === 0) continue;
      if (!openEligibleLhIdx[item.lhIdx]) continue;
      const next = [...baseFretsLH];
      next[item.lhIdx] = 0;
      pushBuiltIfValid(next, base);
    }

    for (const add of mutedIdx) {
      if (!openEligibleLhIdx[add.lhIdx]) continue;
      for (const mute of usedIdx) {
        const next = [...baseFretsLH];
        next[add.lhIdx] = 0;
        next[mute.lhIdx] = null;
        pushBuiltIfValid(next, base);
      }
    }
  }

  return out.sort((a, b) => (a.minFret - b.minFret) || (a.span - b.span) || (a.maxFret - b.maxFret) || a.frets.localeCompare(b.frets));
}

function buildStringSetsForNoteCount(noteCount) {
  const out = [];
  const rec = (start, acc) => {
    if (acc.length === noteCount) {
      if (acc[acc.length - 1] - acc[0] <= noteCount) out.push([...acc]);
      return;
    }
    for (let s = start; s < 6; s++) {
      acc.push(s);
      rec(s + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return out;
}

function buildPermutations(list) {
  const out = [];
  const a = [...list];
  const rec = (l) => {
    if (l === a.length) {
      out.push([...a]);
      return;
    }
    for (let i = l; i < a.length; i++) {
      [a[l], a[i]] = [a[i], a[l]];
      rec(l + 1);
      [a[l], a[i]] = [a[i], a[l]];
    }
  };
  rec(0);
  return out;
}

function generateExactIntervalChordVoicings({ rootPc, intervals, bassInterval = 0, maxFret, maxSpan = 5 }) {
  const wanted = Array.from(new Set((intervals || []).map(mod12)));
  const noteCount = wanted.length;
  if (noteCount < 3 || noteCount > 6) return [];

  const stringSets = buildStringSetsForNoteCount(noteCount);
  const perms = buildPermutations(wanted);
  const out = [];
  const seen = new Set();
  const wantedBass = mod12(bassInterval);

  for (const set of stringSets) {
    for (const perm of perms) {
      const fretLists = perm.map((intv, idx) => fretsForPcOnString(set[idx], mod12(rootPc + intv), maxFret));
      const fretsLH = [null, null, null, null, null, null];

      const rec = (idx, minF, maxF2) => {
        if (idx === noteCount) {
          const v = buildVoicingFromFretsLH({ fretsLH, rootPc, maxFret });
          if (!v || !isErgonomicVoicing(v, maxSpan)) return;
          if (v.notes.length !== noteCount) return;
          if (v.relIntervals.size !== wanted.length) return;
          if (!wanted.every((x) => v.relIntervals.has(x))) return;

          const bassInt = mod12(v.bassPc - rootPc);
          if (bassInt !== wantedBass) return;

          const key = `${v.frets}|${wantedBass}`;
          if (seen.has(key)) return;
          seen.add(key);
          out.push({ ...v, span: v.span });
          return;
        }

        for (const fret of fretLists[idx]) {
          const nextMin = fret > 0 ? (minF == null ? fret : Math.min(minF, fret)) : minF;
          const nextMax = fret > 0 ? (maxF2 == null ? fret : Math.max(maxF2, fret)) : maxF2;
          const nextSpan = nextMin == null || nextMax == null ? 0 : (nextMax - nextMin);
          if (nextSpan > maxSpan) continue;
          fretsLH[5 - set[idx]] = fret;
          rec(idx + 1, nextMin, nextMax);
          fretsLH[5 - set[idx]] = null;
        }
      };

      rec(0, null, null);
    }
  }

  out.sort((a, b) => (a.minFret - b.minFret) || (a.span - b.span) || (a.maxFret - b.maxFret));
  return out;
}

function isDropForm(form) {
  return String(form || "").startsWith("drop");
}

function isOpenForm(form) {
  return String(form || "") === "open";
}

function voicingPitchSpan(v) {
  if (!v?.notes?.length) return 0;
  const pitches = v.notes.map((n) => pitchAt(n.sIdx, n.fret));
  return Math.max(...pitches) - Math.min(...pitches);
}

function isClosedPositionVoicing(v) {
  return voicingPitchSpan(v) <= 12;
}

function filterVoicingsByForm(voicings, form) {
  const list = Array.isArray(voicings) ? voicings : [];
  if (isDropForm(form)) return list;
  if (isOpenForm(form)) return list.filter((v) => !isClosedPositionVoicing(v));
  return list.filter((v) => isClosedPositionVoicing(v));
}

function positionFormFromEffectiveForm(form, fallback = "closed") {
  if (isDropForm(form)) return fallback;
  return isOpenForm(form) ? "open" : "closed";
}

function dropFormFromEffectiveForm(form) {
  return isDropForm(form) ? form : "none";
}

function structureUsesManualForm(structure) {
  return structure !== "chord";
}

function normalizeChordInversionSelection(value) {
  return ["root", "1", "2", "3", "all"].includes(value) ? value : "root";
}

function normalizeChordFormToInversion(form) {
  const normalized = normalizeChordInversionSelection(form);
  return normalized === "all" ? "root" : normalized;
}

function concreteInversionsForSelection(selection, allowThirdInversion = true) {
  const allowed = allowThirdInversion ? ["root", "1", "2", "3"] : ["root", "1", "2"];
  const normalized = normalizeChordInversionSelection(selection);
  if (normalized === "all") return allowed;
  return allowed.includes(normalized) ? [normalized] : ["root"];
}

function positionFormLabel(value) {
  return value === "open" ? "Abierto" : "Cerrado";
}

function selectedInversionLabel(value, allowThirdInversion = true) {
  const normalized = normalizeChordInversionSelection(value);
  if (normalized === "all") return "Todas las inversiones";
  const list = allowThirdInversion ? CHORD_INVERSIONS : CHORD_INVERSIONS.filter((x) => x.value !== "3");
  return list.find((x) => x.value === normalized)?.label || "Fundamental";
}

function actualVoicingShapeSummary(voicing, requestedForm, positionForm) {
  if (voicing?._form && isDropForm(voicing._form)) {
    return {
      position: "Abierto",
      drop: CHORD_FORMS.find((x) => x.value === voicing._form)?.label || "Drop",
    };
  }
  if (isDropForm(requestedForm)) {
    return {
      position: positionFormLabel(positionFormFromEffectiveForm(requestedForm, positionForm || "closed")),
      drop: CHORD_FORMS.find((x) => x.value === requestedForm)?.label || "Drop",
    };
  }
  return {
    position: studyVoicingFormLabel(voicing, requestedForm),
    drop: null,
  };
}

function buildChordHeaderSummary({ name, plan, voicing, positionForm }) {
  if (!plan) return name || "";
  const parts = [name || ""];
  const layer = chordEngineLayerLabel(plan);
  if (layer && layer !== "—") parts.push(layer);

  const shape = actualVoicingShapeSummary(voicing, plan.form, positionForm);
  if (shape.position) parts.push(shape.position);
  if (shape.drop) parts.push(shape.drop);

  parts.push(voicing ? actualInversionLabelFromVoicing(plan, voicing) : selectedInversionLabel(plan.inversion, plan.ui?.allowThirdInversion));
  return parts.filter(Boolean).join(" - ");
}

function bassIntervalsForSelection(plan) {
  const inversions = concreteInversionsForSelection(plan?.inversion, plan?.ui?.allowThirdInversion);
  return Array.from(new Set(inversions.map((inv) => chordBassInterval({
    quality: plan.quality,
    suspension: plan.suspension,
    structure: plan.structure,
    inversion: inv,
    chordIntervals: plan.intervals,
    ext7: plan.ext7,
    ext6: plan.ext6,
    ext9: plan.ext9,
    ext11: plan.ext11,
    ext13: plan.ext13,
  })).map(mod12)));
}

function dedupeAndSortVoicings(list) {
  const map = new Map();
  for (const item of list || []) {
    if (!item?.frets) continue;
    const prev = map.get(item.frets);
    if (!prev) {
      map.set(item.frets, item);
      continue;
    }

    const prevCost = (prev.minFret ?? 0) * 10 + (prev.span ?? 0);
    const nextCost = (item.minFret ?? 0) * 10 + (item.span ?? 0);
    const prevHasDropMeta = !!prev._form && isDropForm(prev._form);
    const nextHasDropMeta = !!item._form && isDropForm(item._form);

    if (nextCost < prevCost) {
      map.set(item.frets, item);
      continue;
    }

    if (nextCost === prevCost) {
      if (nextHasDropMeta && !prevHasDropMeta) {
        map.set(item.frets, item);
        continue;
      }
      if ((item._sourceRootPc != null) && (prev._sourceRootPc == null)) {
        map.set(item.frets, item);
        continue;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.minFret - b.minFret) || (a.span - b.span) || (a.maxFret - b.maxFret) || a.frets.localeCompare(b.frets));
}

function buildOpenSupersetTetradVoicings({ rootCandidates, inversionChoices, plan, maxFret, maxSpan }) {
  const topVoiceOffset = plan.topVoiceOffset;
  if (topVoiceOffset == null) return [];

  const normalOpen = rootCandidates.flatMap((rootCandidate) =>
    inversionChoices.flatMap((inv) =>
      filterVoicingsByForm(generateTetradVoicings({
        rootPc: rootCandidate,
        thirdOffset: plan.thirdOffset,
        fifthOffset: plan.fifthOffset,
        seventhOffset: topVoiceOffset,
        inversion: inv,
        maxFret,
        maxSpan,
      }), "open").map((v) => normalizeGeneratedVoicingForDisplay(v, plan.rootPc, rootCandidate))
    )
  );

  if (!plan.ui?.dropEligible) return dedupeAndSortVoicings(normalOpen);

  const dropForms = CHORD_FORMS.filter((x) => isDropForm(x.value)).map((x) => x.value);
  const dropOpen = rootCandidates.flatMap((rootCandidate) =>
    inversionChoices.flatMap((inv) =>
      dropForms.flatMap((form) =>
        generateDropTetradVoicings({
          rootPc: rootCandidate,
          thirdOffset: plan.thirdOffset,
          fifthOffset: plan.fifthOffset,
          seventhOffset: plan.seventhOffset,
          form,
          inversion: inv,
          maxFret,
          maxSpan,
        }).map((v) => normalizeGeneratedVoicingForDisplay(v, plan.rootPc, rootCandidate))
      )
    )
  );

  return dedupeAndSortVoicings([...normalOpen, ...dropOpen]);
}

function isSymmetricDim7Plan(plan) {
  if (!plan) return false;
  if (plan.quality !== "dim") return false;
  const sig = Array.from(new Set((plan.intervals || []).map(mod12))).sort((a, b) => a - b).join(",");
  return sig === "0,3,6,9";
}

function symmetricRootCandidatesForPlan(plan) {
  if (!isSymmetricDim7Plan(plan)) return [plan?.rootPc ?? 0];
  if (plan?.inversion !== "all") return [plan?.rootPc ?? 0];
  return [0, 3, 6, 9].map((shift) => mod12((plan?.rootPc ?? 0) + shift));
}

function normalizeGeneratedVoicingForDisplay(voicing, displayRootPc, sourceRootPc) {
  if (!voicing) return voicing;
  return {
    ...voicing,
    relIntervals: new Set((voicing.notes || []).map((n) => mod12(n.pc - displayRootPc))),
    _sourceRootPc: sourceRootPc,
  };
}

function singleAddOffsetFromUi({ ext6, ext9, ext11, ext13 }) {
  if (ext13) return 9;
  if (ext11) return 5;
  if (ext9) return 2;
  if (ext6) return 9;
  return null;
}

function isStrictFourNoteDropEligible({ structure, ext7, ext6, ext9, ext11, ext13 }) {
  if (structure !== "tetrad") return false;
  const addCount = addSelectionCount({ ext6, ext9, ext11, ext13 });
  if (hasEffectiveSeventh({ structure, ext7, ext6, ext9, ext11, ext13 })) return addCount === 0;
  return addCount === 1;
}

function addSelectionCount({ ext6, ext9, ext11, ext13 }) {
  return (ext6 ? 1 : 0) + (ext9 ? 1 : 0) + (ext11 ? 1 : 0) + (ext13 ? 1 : 0);
}

function isSingleAddChordSelection({ ext7, ext6, ext9, ext11, ext13 }) {
  return !ext7 && addSelectionCount({ ext6, ext9, ext11, ext13 }) === 1;
}

function isMultiAddChordSelection({ ext7, ext6, ext9, ext11, ext13 }) {
  return !ext7 && addSelectionCount({ ext6, ext9, ext11, ext13 }) >= 2;
}

function buildMultiAddDisplaySuffix({ quality, suspension = "none", ext6, ext9, ext11, ext13 }) {
  const parts = [];
  if (ext6) parts.push("6");
  if (ext9) parts.push("9");
  if (ext11) parts.push("11");
  if (ext13) parts.push("13");
  if (!parts.length) return "";

  const sus = suspension || "none";
  if (sus === "sus2" || sus === "sus4") {
    return `${sus}(add${parts.join(",")})`;
  }
  if (quality === "min") {
    return `m(add${parts.join(",")})`;
  }
  return `add${parts.join(",")}`;
}

function hasEffectiveSeventh({ structure, ext7, ext6, ext9, ext11, ext13 }) {
  if (structure === "tetrad") {
    const addOnly = ((ext6 ? 1 : 0) + (ext9 ? 1 : 0) + (ext11 ? 1 : 0) + (ext13 ? 1 : 0)) > 0;
    return !addOnly;
  }
  return !!ext7;
}

function chordThirdOffsetFromUI(quality, suspension) {
  if (suspension === "sus2") return 2;
  if (suspension === "sus4") return 5;
  return quality === "maj" || quality === "dom" ? 4 : 3;
}

function chordFifthOffsetFromUI(quality, suspension) {
  if (suspension && suspension !== "none") return 7;
  return quality === "dim" || quality === "hdim" ? 6 : 7;
}

function buildChordUiRestrictions({ structure, ext7, ext6, ext9, ext11, ext13 }) {
  const dropEligible = isStrictFourNoteDropEligible({ structure, ext7, ext6, ext9, ext11, ext13 });
  return {
    usesManualForm: structureUsesManualForm(structure),
    allowThirdInversion: structure !== "triad",
    dropEligible,
    ext: {
      showSeven: true,
      showSix: true,
      showNine: structure !== "triad",
      showEleven: structure !== "triad",
      showThirteen: structure !== "triad",
      canToggleSeven: structure === "chord",
      canToggleSix: structure !== "triad",
      canToggleNine: structure !== "triad",
      canToggleEleven: structure !== "triad",
      canToggleThirteen: structure !== "triad",
    },
  };
}

function buildChordEnginePlan({
  rootPc,
  quality,
  suspension = "none",
  structure,
  inversion,
  form,
  ext7,
  ext6,
  ext9,
  ext11,
  ext13,
}) {
  const inversionSelection = normalizeChordInversionSelection(inversion);
  const inversionSingle = inversionSelection === "all" ? "root" : inversionSelection;
  const thirdOffset = chordThirdOffsetFromUI(quality, suspension);
  const fifthOffset = chordFifthOffsetFromUI(quality, suspension);
  const seventhOffset = hasEffectiveSeventh({ structure, ext7, ext6, ext9, ext11, ext13 }) ? seventhOffsetForQuality(quality) : null;
  const singleAddOffset = singleAddOffsetFromUi({ ext6, ext9, ext11, ext13 });
  const topVoiceOffset = seventhOffset ?? singleAddOffset;
  const intervals = buildChordIntervals({ quality, suspension, structure, ext7, ext6, ext9, ext11, ext13 });
  const bassInterval = chordBassInterval({
    quality,
    suspension,
    structure,
    inversion: inversionSingle,
    chordIntervals: intervals,
    ext7,
    ext6,
    ext9,
    ext11,
    ext13,
  });

  const strictDrop = isDropForm(form) && isStrictFourNoteDropEligible({ structure, ext7, ext6, ext9, ext11, ext13 });
  const singleAdd = isSingleAddChordSelection({ ext7, ext6, ext9, ext11, ext13 });
  const multiAdd = isMultiAddChordSelection({ ext7, ext6, ext9, ext11, ext13 });
  const triadOnly = structure === "triad" && !ext7 && !ext6;
  const tetradFamily = structure === "tetrad" || (structure === "triad" && (ext7 || ext6));
  const chordFamily = structure === "chord";
  const extended = chordFamily && !singleAdd && !multiAdd && (ext7 || ext6 || ext9 || ext11 || ext13);

  let layer = "unsupported";
  let generator = "none";

  if (strictDrop) {
    layer = "drop";
    generator = "drop";
  } else if (triadOnly) {
    layer = "triad";
    generator = "triad";
  } else if (tetradFamily && singleAdd) {
    layer = "add";
    generator = "tetrad";
  } else if (tetradFamily) {
    layer = "tetrad";
    generator = "tetrad";
  } else if (chordFamily && multiAdd) {
    layer = "multi_add";
    generator = "exact";
  } else if (chordFamily && singleAdd) {
    layer = "add";
    generator = "tetrad";
  } else if (extended) {
    layer = "extended";
    generator = "json";
  } else if (chordFamily) {
    layer = "chord";
    generator = "json";
  }

  const ui = buildChordUiRestrictions({ structure, ext7, ext6, ext9, ext11, ext13 });

  return {
    rootPc: mod12(rootPc),
    quality,
    suspension,
    structure,
    inversion: inversionSelection,
    inversionSingle,
    form,
    ext7,
    ext6,
    ext9,
    ext11,
    ext13,
    thirdOffset,
    fifthOffset,
    seventhOffset,
    singleAddOffset,
    topVoiceOffset,
    intervals,
    bassInterval,
    strictDrop,
    singleAdd,
    multiAdd,
    triadOnly,
    tetradFamily,
    chordFamily,
    extended,
    layer,
    generator,
    ui,
  };
}

function chordEngineLayerLabel(plan) {
  switch (plan?.layer) {
    case "triad": return "Triada";
    case "tetrad": return "Cuatriada";
    case "add": return "Add";
    case "extended": return "Extendido";
    case "multi_add": return "Add múltiple";
    case "drop": return "Drop";
    case "chord": return "Acorde";
    case "quartal": return "Cuartal";
    case "guide_tones": return "Notas guía";
    default: return "—";
  }
}

function chordEngineGeneratorLabel(plan) {
  switch (plan?.generator) {
    case "triad": return "Triad";
    case "tetrad": return "Tetrad";
    case "drop": return "Drop";
    case "exact": return "Exact";
    case "json": return "JSON";
    case "quartal": return "Quartal";
    default: return "—";
  }
}

function studyVoicingFormLabel(voicing, form) {
  if (voicing?.quartalSpreadKind) {
    return voicing.quartalSpreadKind === "open" ? "Abierto" : "Cerrado";
  }
  if (isDropForm(form)) {
    return CHORD_FORMS.find((x) => x.value === form)?.label || "Drop";
  }
  if (!voicing) return isOpenForm(form) ? "Abierto" : "Cerrado";
  return isClosedPositionVoicing(voicing) ? "Cerrado" : "Abierto";
}

function explainStudyRules(plan) {
  if (!plan) return [];
  const out = [];
  if (plan.layer === "quartal") {
    out.push("En cuartales el voicing real depende del apilado abierto/cerrado y del número de voces.");
    if (plan.quartalReference === "scale") out.push("Si la referencia es diatónica, la raíz real puede desplazarse al grado generado.");
    return out;
  }
  if (plan.layer === "guide_tones") {
    out.push("Las notas guía usan shells de 3 notas con 1, 3 y 7/6 según la calidad.");
    return out;
  }
  if (!plan.ui?.usesManualForm) out.push("En estructura Acorde la forma es automática.");
  if (!plan.ui?.allowThirdInversion) out.push("La 3ª inversión no está disponible en triadas.");
  if (!plan.ui?.dropEligible) out.push("Los drops solo son válidos en cuatriadas estrictas de 4 notas.");
  if (plan.layer === "multi_add") out.push("Las combinaciones add múltiples usan el generador exacto de intervalos.");
  if (plan.layer === "extended") out.push("Los acordes extendidos usan el generador de voicings del dataset JSON.");
  if (plan.layer === "add") out.push("Los add simples se resuelven como cuatriadas sin 7ª real.");
  return out;
}

function buildChordNamingExplanation(plan) {
  if (!plan) return [];
  const out = [];

  if (plan.layer === "quartal") {
    out.push("Se nombra cuartal porque las voces se apilan por cuartas respecto a la raíz actual.");
    if (plan.quartalType === "mixed") out.push("Es mixto porque combina al menos una 4ª aumentada con 4ªs justas.");
    else out.push("Es puro porque todas las cuartas del apilado son justas.");
    return out;
  }

  if (plan.layer === "guide_tones") {
    out.push("Se nombra como shell de notas guía porque conserva 1, 3 y 7/6 como núcleo armónico.");
    if (plan.guideToneQuality === "maj6") out.push("La tercera voz es 6 en lugar de 7, por eso el color resultante es 6.");
    return out;
  }

  if (plan.suspension === "sus2") out.push("Se nombra sus2 porque la 3ª se sustituye por 2ª.");
  else if (plan.suspension === "sus4") out.push("Se nombra sus4 porque la 3ª se sustituye por 4ª.");
  else if (plan.quality === "maj") out.push("La calidad sale de 3ª mayor y 5ª justa.");
  else if (plan.quality === "dom") out.push("La base es mayor y, cuando aparece la 7ª, se interpreta como dominante.");
  else if (plan.quality === "min") out.push("La calidad sale de 3ª menor y 5ª justa.");
  else if (plan.quality === "dim") out.push("La calidad sale de 3ª menor y 5ª disminuida.");
  else if (plan.quality === "hdim") out.push("Se interpreta como m7(b5): 3ª menor, 5ª disminuida y 7ª menor.");

  if (plan.layer === "triad") out.push("La estructura efectiva es una triada.");
  if (plan.layer === "tetrad") out.push("La estructura efectiva es una cuatriada.");
  if (plan.layer === "drop") out.push("El nombre mantiene el acorde, pero el voicing se fuerza como drop.");
  if (plan.layer === "extended") out.push("El sufijo extendido sale de 7ª y/o tensiones superiores.");
  if (plan.layer === "add") out.push("Se nombra como add porque añade tensión sin 7ª real.");
  if (plan.layer === "multi_add") out.push("Se nombra como add múltiple porque combina varias tensiones sin 7ª.");

  if (plan.ext7 && plan.seventhOffset != null) out.push(`Incluye ${intervalToDegreeToken(plan.seventhOffset)}, por eso aparece la 7ª.`);
  else if (plan.singleAddOffset != null) out.push(`La cuarta voz real es ${intervalToDegreeToken(plan.singleAddOffset)}.`);
  if (plan.ext6) out.push("Incluye 6 como color añadido.");
  if (plan.ext9) out.push("Incluye 9 como tensión añadida.");
  if (plan.ext11) out.push("Incluye 11 como tensión añadida.");
  if (plan.ext13) out.push("Incluye 13 como tensión añadida.");

  return out;
}

function requestedFormLabel(plan) {
  if (!plan) return "—";
  if (isDropForm(plan.form)) return CHORD_FORMS.find((x) => x.value === plan.form)?.label || "Drop";
  return isOpenForm(plan.form) ? "Abierto" : "Cerrado";
}

function actualInversionLabelFromVoicing(plan, voicing) {
  if (!plan || !voicing) return "—";
  const bassInt = mod12(voicing.bassPc - plan.rootPc);
  if (bassInt === 0) return "Fundamental";
  if (bassInt === mod12(plan.thirdOffset)) return "1ª inversión";
  if (bassInt === mod12(plan.fifthOffset)) return "2ª inversión";
  if (plan.topVoiceOffset != null && bassInt === mod12(plan.topVoiceOffset)) return "3ª inversión";
  return `Bajo ${intervalToDegreeToken(bassInt)}`;
}

function analyzeVoicingVsPlan(plan, voicing, preferSharps) {
  if (!plan) {
    return {
      requested: [],
      actual: [],
      missing: [],
      extra: [],
      requestedForm: "—",
      actualForm: "—",
      actualNotes: [],
      requestedBass: "—",
      actualBass: "—",
      actualInversion: "—",
    };
  }

  const requested = Array.from(new Set((plan.intervals || []).map(mod12))).sort((a, b) => a - b);
  const actual = voicing ? Array.from(new Set(Array.from(voicing.relIntervals || []).map(mod12))).sort((a, b) => a - b) : [];
  const requestedTokens = requested.map((i) => intervalToDegreeToken(i));
  const actualTokens = actual.map((i) => intervalToDegreeToken(i));
  const missing = requested.filter((i) => !actual.includes(i)).map((i) => intervalToDegreeToken(i));
  const extra = actual.filter((i) => !requested.includes(i)).map((i) => intervalToDegreeToken(i));

  return {
    requested: requestedTokens,
    actual: actualTokens,
    missing,
    extra,
    requestedForm: requestedFormLabel(plan),
    actualForm: studyVoicingFormLabel(voicing, plan.form),
    actualNotes: voicing ? [...voicing.notes].sort((a, b) => pitchAt(a.sIdx, a.fret) - pitchAt(b.sIdx, b.fret)).map((n) => pcToName(n.pc, preferSharps)) : [],
    requestedBass: pcToName(mod12(plan.rootPc + plan.bassInterval), preferSharps),
    actualBass: voicing ? pcToName(voicing.bassPc, preferSharps) : "—",
    actualInversion: actualInversionLabelFromVoicing(plan, voicing),
  };
}

function analyzeScaleTensionsForChord({ activeScaleRootPc, scaleIntervals, chordRootPc, chordIntervals, preferSharps }) {
  const scalePcSet = new Set((scaleIntervals || []).map((i) => mod12(activeScaleRootPc + i)));
  const chordSet = new Set((chordIntervals || []).map(mod12));
  const candidates = [
    { intv: 1, label: "b9" },
    { intv: 2, label: "9" },
    { intv: 3, label: "#9" },
    { intv: 5, label: "11" },
    { intv: 6, label: "#11" },
    { intv: 8, label: "b13" },
    { intv: 9, label: "13" },
  ];

  const available = [];
  const unavailable = [];

  for (const c of candidates) {
    if (chordSet.has(c.intv)) continue;
    const notePc = mod12(chordRootPc + c.intv);
    const item = `${c.label} (${pcToName(notePc, preferSharps)})`;
    if (scalePcSet.has(notePc)) available.push(item);
    else unavailable.push(item);
  }

  return { available, unavailable };
}

function buildDominantInfo(targetRootPc, preferSharps) {
  const rootPc = mod12(targetRootPc + 7);
  const rootName = pcToName(rootPc, preferSharps);
  const targetName = pcToName(mod12(targetRootPc), preferSharps);
  const notes = spellChordNotes({ rootPc, chordIntervals: [0, 4, 7, 10], preferSharps });
  return {
    rootPc,
    name: `${rootName}7`,
    notes,
    relation: `V7 \u2192 ${targetName}`,
  };
}

function buildBackdoorDominantInfo(targetRootPc, preferSharps) {
  const rootPc = mod12(targetRootPc - 2);
  const rootName = pcToName(rootPc, preferSharps);
  const targetName = pcToName(mod12(targetRootPc), preferSharps);
  const notes = spellChordNotes({ rootPc, chordIntervals: [0, 4, 7, 10], preferSharps });
  return {
    rootPc,
    name: `${rootName}7`,
    notes,
    relation: `bVII7 \u2192 ${targetName}`,
  };
}

// ============================================================================
// DETECCIÓN DE ACORDES DESDE NOTAS SELECCIONADAS
// ============================================================================

const CHORD_DETECT_FORMULAS = [
  { id: "5", intervals: [0, 7], degreeLabels: ["1", "5"], suffix: "5", ui: null, manualOnly: true, allowDyad: true },
  { id: "sus2no5", intervals: [0, 2], degreeLabels: ["1", "2"], suffix: "sus2(no5)", ui: null, manualOnly: true, allowDyad: true },
  { id: "sus4no5", intervals: [0, 5], degreeLabels: ["1", "4"], suffix: "sus4(no5)", ui: null, manualOnly: true, allowDyad: true },
  { id: "majno5", intervals: [0, 4], degreeLabels: ["1", "3"], suffix: "(no5)", ui: null, manualOnly: true, allowDyad: true },
  { id: "minno5", intervals: [0, 3], degreeLabels: ["1", "b3"], suffix: "m(no5)", ui: null, manualOnly: true, allowDyad: true },
  { id: "maj", intervals: [0, 4, 7], degreeLabels: ["1", "3", "5"], suffix: "", ui: { quality: "maj", suspension: "none", structure: "triad", inversion: "all", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "min", intervals: [0, 3, 7], degreeLabels: ["1", "b3", "5"], suffix: "m", ui: { quality: "min", suspension: "none", structure: "triad", inversion: "all", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "dim", intervals: [0, 3, 6], degreeLabels: ["1", "b3", "b5"], suffix: "dim", ui: { quality: "dim", suspension: "none", structure: "triad", inversion: "all", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "sus2", intervals: [0, 2, 7], degreeLabels: ["1", "2", "5"], suffix: "sus2", ui: { quality: "maj", suspension: "sus2", structure: "triad", inversion: "all", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "sus4", intervals: [0, 5, 7], degreeLabels: ["1", "4", "5"], suffix: "sus4", ui: { quality: "maj", suspension: "sus4", structure: "triad", inversion: "all", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "6", intervals: [0, 4, 7, 9], degreeLabels: ["1", "3", "5", "6"], suffix: "6", ui: { quality: "maj", suspension: "none", structure: "tetrad", inversion: "all", form: "open", positionForm: "open", ext7: false, ext6: true, ext9: false, ext11: false, ext13: false } },
  { id: "m6", intervals: [0, 3, 7, 9], degreeLabels: ["1", "b3", "5", "6"], suffix: "m6", ui: { quality: "min", suspension: "none", structure: "tetrad", inversion: "all", form: "open", positionForm: "open", ext7: false, ext6: true, ext9: false, ext11: false, ext13: false } },
  { id: "add9", intervals: [0, 2, 4, 7], degreeLabels: ["1", "9", "3", "5"], suffix: "add9", ui: { quality: "maj", suspension: "none", structure: "tetrad", inversion: "all", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: true, ext11: false, ext13: false } },
  { id: "madd9", intervals: [0, 2, 3, 7], degreeLabels: ["1", "9", "b3", "5"], suffix: "m(add9)", ui: { quality: "min", suspension: "none", structure: "tetrad", inversion: "all", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: true, ext11: false, ext13: false } },
  { id: "sus2add13no5", intervals: [0, 2, 9], degreeLabels: ["1", "2", "13"], suffix: "sus2add13(no5)", ui: null, manualOnly: true },
  { id: "add11", intervals: [0, 4, 5, 7], degreeLabels: ["1", "3", "11", "5"], suffix: "add11", ui: { quality: "maj", suspension: "none", structure: "tetrad", inversion: "all", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: true, ext13: false } },
  { id: "madd11", intervals: [0, 3, 5, 7], degreeLabels: ["1", "b3", "11", "5"], suffix: "m(add11)", ui: { quality: "min", suspension: "none", structure: "tetrad", inversion: "all", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: true, ext13: false } },
  { id: "maddb13", intervals: [0, 3, 7, 8], degreeLabels: ["1", "b3", "5", "b13"], suffix: "m(addb13)", ui: null },
  { id: "maj9", intervals: [0, 2, 4, 7, 11], degreeLabels: ["1", "9", "3", "5", "7"], suffix: "maj9", ui: { quality: "maj", suspension: "none", structure: "chord", inversion: "all", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: true, ext11: false, ext13: false } },
  { id: "9", intervals: [0, 2, 4, 7, 10], degreeLabels: ["1", "9", "3", "5", "b7"], suffix: "9", ui: { quality: "dom", suspension: "none", structure: "chord", inversion: "all", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: true, ext11: false, ext13: false } },
  { id: "m9", intervals: [0, 2, 3, 7, 10], degreeLabels: ["1", "9", "b3", "5", "b7"], suffix: "m9", ui: { quality: "min", suspension: "none", structure: "chord", inversion: "all", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: true, ext11: false, ext13: false } },
  { id: "maj7", intervals: [0, 4, 7, 11], degreeLabels: ["1", "3", "5", "7"], suffix: "maj7", ui: { quality: "maj", suspension: "none", structure: "tetrad", inversion: "all", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "7", intervals: [0, 4, 7, 10], degreeLabels: ["1", "3", "5", "b7"], suffix: "7", ui: { quality: "dom", suspension: "none", structure: "tetrad", inversion: "all", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "m7", intervals: [0, 3, 7, 10], degreeLabels: ["1", "b3", "5", "b7"], suffix: "m7", ui: { quality: "min", suspension: "none", structure: "tetrad", inversion: "all", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "mmaj7", intervals: [0, 3, 7, 11], degreeLabels: ["1", "b3", "5", "7"], suffix: "m(maj7)", ui: null },
  { id: "m7b5", intervals: [0, 3, 6, 10], degreeLabels: ["1", "b3", "b5", "b7"], suffix: "m7(b5)", ui: { quality: "hdim", suspension: "none", structure: "tetrad", inversion: "all", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "dim7", intervals: [0, 3, 6, 9], degreeLabels: ["1", "b3", "b5", "bb7"], suffix: "dim7", ui: { quality: "dim", suspension: "none", structure: "tetrad", inversion: "all", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "maj7sharp5", intervals: [0, 4, 8, 11], degreeLabels: ["1", "3", "#5", "7"], suffix: "maj7#5", ui: null },
  { id: "7sharp5", intervals: [0, 4, 8, 10], degreeLabels: ["1", "3", "#5", "b7"], suffix: "7#5", ui: null },
  { id: "7flat5", intervals: [0, 4, 6, 10], degreeLabels: ["1", "3", "b5", "b7"], suffix: "7b5", ui: null },
];

function appendMissingDegreesToSuffix(baseSuffix, missingDegrees) {
  if (!missingDegrees?.length) return baseSuffix;
  const miss = missingDegrees.map((x) => `no${x}`).join(",");
  if (!baseSuffix) return `(${miss})`;
  if (baseSuffix.endsWith(")")) return `${baseSuffix.slice(0, -1)},${miss})`;
  return `${baseSuffix}(${miss})`;
}

function detectFormulaRole(formula, interval) {
  const idx = formula?.intervals?.findIndex((x) => mod12(x) === mod12(interval));
  const label = idx >= 0 ? String(formula.degreeLabels[idx] || "") : "";
  if (mod12(interval) === 0) return "root";
  if (label.includes("13") || label === "6") return "thirteenth";
  if (label.includes("11") || label === "4") return "eleventh";
  if (label.includes("9") || label === "2") return "ninth";
  if (label.includes("7")) return "seventh";
  if (label.includes("5")) return "fifth";
  if (label.includes("3") || label === "2" || label === "4") return "third";
  return "other";
}

function isExtensionLikeDegreeLabel(label) {
  const s = String(label || "").toLowerCase();
  return s.includes("6") || s.includes("7") || s.includes("9") || s.includes("11") || s.includes("13");
}

function isThirdDegreeLabel(label) {
  const s = String(label || "").toLowerCase();
  return s === "3" || s === "b3" || s === "#3";
}

function isFifthDegreeLabel(label) {
  const s = String(label || "").toLowerCase();
  return s.includes("5");
}

function isSeventhDegreeLabel(label) {
  const s = String(label || "").toLowerCase();
  return s.includes("7");
}

function isSixthDegreeLabel(label) {
  const s = String(label || "").toLowerCase();
  return s === "6" || s.includes("13");
}

function suffixSemanticallyContainsDegree(suffix, label) {
  const s = String(suffix || "").toLowerCase();
  const l = String(label || "").toLowerCase();
  if (!s || !l) return false;
  return s.includes(l);
}

function allowMissingThirdCandidate(candidate) {
  if (!candidate) return false;
  if (candidate.missingLabels.length !== 1) return false;
  if (!isThirdDegreeLabel(candidate.missingLabels[0])) return false;
  if (candidate.externalBassInterval != null) return false;

  const visible = candidate.formula.intervals
    .map((intv, idx) => candidate.visibleIntervals.includes(mod12(intv)) ? String(candidate.formula.degreeLabels[idx] || "") : null)
    .filter(Boolean);

  const hasRoot = candidate.visibleIntervals.includes(0);
  const hasFifth = visible.some((x) => isFifthDegreeLabel(x));
  const hasSeventh = visible.some((x) => isSeventhDegreeLabel(x));
  const hasSixth = visible.some((x) => isSixthDegreeLabel(x));
  return hasRoot && hasFifth && (hasSeventh || hasSixth);
}

function shouldFilterExternalBassSubsetCandidate(candidate, exactCandidates) {
  if (candidate?.formula?.quartal) return false;
  if (!candidate || candidate.externalBassInterval == null) return false;
  const wanted = new Set([...candidate.visibleIntervals, mod12(candidate.externalBassInterval)].map(mod12));

  return exactCandidates.some((exact) => {
    if (!exact?.exact) return false;
    if (exact.rootPc !== candidate.rootPc) return false;
    if (exact.bassPc !== candidate.bassPc) return false;
    const exactInts = new Set((exact.visibleIntervals || []).map(mod12));
    for (const intv of wanted) {
      if (!exactInts.has(intv)) return false;
    }
    return true;
  });
}

function candidateHeardIntervalSignature(candidate) {
  if (!candidate) return "";
  const ints = [...(candidate.visibleIntervals || [])];
  if (candidate.externalBassInterval != null) ints.push(mod12(candidate.externalBassInterval));
  return Array.from(new Set(ints.map(mod12))).sort((a, b) => a - b).join(",");
}

function shouldFilterExactSubsetCandidate(candidate, exactCandidates) {
  if (candidate?.formula?.quartal) return false;
  if (!candidate?.exact) return false;
  const ownSig = candidateHeardIntervalSignature(candidate);
  if (!ownSig) return false;

  return exactCandidates.some((other) => {
    if (!other?.exact) return false;
    if (other === candidate) return false;
    if (other.rootPc !== candidate.rootPc) return false;
    if (other.bassPc !== candidate.bassPc) return false;
    if (candidateHeardIntervalSignature(other) !== ownSig) return false;

    const ownCount = (candidate.formula?.intervals || []).length;
    const otherCount = (other.formula?.intervals || []).length;
    if (otherCount !== ownCount) return otherCount > ownCount;

    const ownMissing = (candidate.missingLabels || []).length;
    const otherMissing = (other.missingLabels || []).length;
    return otherMissing < ownMissing;
  });
}

function candidateVisibleDegreeLabels(candidate) {
  if (!candidate?.formula?.intervals?.length) return [];
  return candidate.formula.intervals
    .map((intv, idx) => candidate.visibleIntervals.includes(mod12(intv)) ? String(candidate.formula.degreeLabels[idx] || "") : null)
    .filter(Boolean);
}

function candidateHasCompleteTriad(candidate) {
  const labels = candidateVisibleDegreeLabels(candidate);
  const hasRoot = candidate.visibleIntervals.includes(0);
  const hasThird = labels.some((x) => isThirdDegreeLabel(x));
  const hasFifth = labels.some((x) => isFifthDegreeLabel(x));
  return hasRoot && hasThird && hasFifth;
}

function candidateIsMissingThirdSeventhLike(candidate) {
  if (!candidate) return false;
  if (!(candidate.missingLabels || []).some((x) => isThirdDegreeLabel(x))) return false;
  const labels = candidateVisibleDegreeLabels(candidate);
  return labels.some((x) => isSeventhDegreeLabel(x) || isSixthDegreeLabel(x));
}

function candidateFormulaComplexityPenalty(candidate) {
  const id = String(candidate?.formula?.id || "");
  if (["maj", "min", "sus2", "sus4"].includes(id)) return 0;
  if (["6", "m6", "add9", "madd9", "add11", "madd11", "sus2add13no5"].includes(id)) return 2;
  if (["maj7", "7", "m7", "m7b5", "dim7"].includes(id)) return 4;
  if (["maj9", "9", "m9"].includes(id)) return 6;
  if (["mmaj7"].includes(id)) return 8;
  if (["maj7sharp5", "7sharp5", "7flat5", "maddb13"].includes(id)) return 12;
  return 7;
}

function candidateProbabilityScore(candidate) {
  if (!candidate) return 999;

  if (candidate?.formula?.quartal) {
    const quartalSize = (candidate.formula?.intervals || []).length;
    let score = candidate.formula?.quartalType === "pure" ? 5 : 7;

    if (candidate.exact) score -= 2;
    else score += 3;

    if (quartalSize > 3) score -= (quartalSize - 3) * 1.1;
    if (candidate.externalBassInterval != null) score += 2.5;
    if (candidate.bassPc === candidate.rootPc) score -= 1.5;

    return Number(score.toFixed(2));
  }

  let score = 0;
  const formulaSize = (candidate.formula?.intervals || []).length;
  const triadCore = candidateHasCompleteTriad(candidate);
  const externalBass = candidate.externalBassInterval != null;
  const visibleLabels = candidateVisibleDegreeLabels(candidate);
  const hasAlteredFifth = visibleLabels.some((x) => {
    const s = String(x || "").toLowerCase();
    return s === "b5" || s === "#5";
  });

  score += candidateFormulaComplexityPenalty(candidate);
  score += (candidate.missingLabels?.length || 0) * 9;
  if (candidate.missingLabels?.some((x) => isThirdDegreeLabel(x))) score += 5;

  if (candidate.exact) score -= 2;
  else score += 2;

  if (triadCore) score -= 3;
  if (hasAlteredFifth) score += 8;

  if (externalBass) {
    if (triadCore && formulaSize === 3 && (candidate.missingLabels?.length || 0) === 0) score -= 8;
    else if (triadCore) score -= 2;
    else score += 4;
  } else if (candidate.bassPc !== candidate.rootPc) {
    score += 1;
  }

  score += Math.max(0, formulaSize - 3) * 1.2;
  score += ((candidate.name || "").match(/[?#b?]/g) || []).length * 0.15;

  return Number(score.toFixed(2));
}

function buildQuartalStepText(step) {
  return step === 6 ? "A4" : "4J";
}

function buildQuartalChainsFromSelected({ rootPc, selectedPcs, allowMixed = true }) {
  const pcs = Array.from(new Set((selectedPcs || []).map(mod12)));
  const selectedSet = new Set(pcs);
  if (!selectedSet.has(mod12(rootPc))) return [];

  const out = [];
  const seen = new Set();
  const maxLen = Math.min(5, pcs.length);

  const rec = (chain, steps) => {
    if (chain.length >= 3) {
      const key = `${chain.join(",")}|${steps.join(",")}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ pcs: [...chain], steps: [...steps] });
      }
    }

    if (chain.length >= maxLen) return;

    const last = chain[chain.length - 1];
    const nextSteps = allowMixed ? [5, 6] : [5];
    for (const step of nextSteps) {
      const nextPc = mod12(last + step);
      if (!selectedSet.has(nextPc)) continue;
      if (chain.includes(nextPc)) continue;
      rec([...chain, nextPc], [...steps, step]);
    }
  };

  rec([mod12(rootPc)], []);
  return out;
}

function buildQuartalManualCandidates(selectedNotes) {
  const list = Array.isArray(selectedNotes) ? [...selectedNotes] : [];
  if (list.length < 3) return [];

  const ordered = [...list].sort((a, b) => a.pitch - b.pitch);
  const bass = ordered[0];
  const uniquePcs = Array.from(new Set(ordered.map((n) => mod12(n.pc))));
  const out = [];
  const seen = new Map();

  for (const rootPc of uniquePcs) {
    const preferSharps = preferSharpsFromMajorTonicPc(mod12(rootPc));
    const chains = buildQuartalChainsFromSelected({ rootPc, selectedPcs: uniquePcs, allowMixed: true });

    for (const chain of chains) {
      const chainSet = new Set(chain.pcs.map(mod12));
      const extras = uniquePcs.filter((pc) => !chainSet.has(mod12(pc)));
      if (extras.length > 1) continue;
      if (extras.length === 1 && mod12(extras[0]) !== mod12(bass.pc)) continue;

      const visibleIntervals = chain.pcs.map((pc) => mod12(pc - rootPc));
      const degreeLabels = visibleIntervals.map((intv) => intervalToSimpleChordDegreeToken(intv));
      const visibleNotes = spellChordNotes({ rootPc, chordIntervals: visibleIntervals, preferSharps });
      const externalBassInterval = extras.length ? mod12(bass.pc - rootPc) : null;
      const bassName = externalBassInterval == null
        ? pcToName(rootPc, preferSharps)
        : spellNoteFromChordInterval(rootPc, externalBassInterval, preferSharps);
      const quartalType = chain.steps.every((step) => step === 5) ? "pure" : "mixed";
      const rootName = pcToName(rootPc, preferSharps);
      const name = `${quartalType === "mixed" ? "Cuartal mixto" : "Cuartal"} ${rootName}${bassName !== rootName ? `/${bassName}` : ""}`;
      const stepText = chain.steps.map(buildQuartalStepText).join(" · ");
      const intervalPairsText = `${visibleNotes.join(" – ")} · bajo en ${bassName}${stepText ? ` · ${stepText}` : ""}`;
      const exact = extras.length === 0 && chain.pcs.length === uniquePcs.length;
      const spreadKind = chain.steps.length
        ? chain.steps.every((step, idx) => {
            const a = ordered[idx];
            const b = ordered[idx + 1];
            return !!a && !!b && (b.pitch - a.pitch) === step;
          })
          ? "closed"
          : "open"
        : "closed";
      const score = Number(((exact ? 6 : 10) + (quartalType === "mixed" ? 2 : 0) + (externalBassInterval != null ? 2 : 0) - Math.max(0, chain.pcs.length - 3)).toFixed(2));

      const candidate = {
        id: `quartal|${quartalType}|${rootPc}|${externalBassInterval == null ? "in" : externalBassInterval}|${chain.pcs.join(".")}`,
        name,
        rootPc,
        bassPc: bass.pc,
        preferSharps,
        formula: {
          id: `quartal_${quartalType}_${visibleIntervals.length}`,
          intervals: visibleIntervals,
          degreeLabels,
          suffix: "",
          ui: null,
          manualOnly: true,
          quartal: true,
          quartalType,
          quartalSteps: [...chain.steps],
        },
        exact,
        score,
        uiPatch: {
          rootPc,
          spellPreferSharps: preferSharps,
          family: "quartal",
          quartalType,
          quartalVoices: String(chain.pcs.length),
          quartalSpread: spreadKind,
          quartalReference: "root",
        },
        intervalPairsText,
        visibleNotes,
        visibleIntervals,
        missingLabels: [],
        externalBassInterval,
      };

      candidate.probabilityScore = candidateProbabilityScore(candidate);

      const dedupeKey = `${candidate.name}|${candidate.intervalPairsText}`;
      const prev = seen.get(dedupeKey);
      if (!prev || candidate.probabilityScore < prev.probabilityScore || (candidate.probabilityScore === prev.probabilityScore && candidate.score < prev.score)) {
        seen.set(dedupeKey, candidate);
      }
    }
  }

  return Array.from(seen.values());
}

function analyzeDetectedChordCandidates(selectedNotes) {
  const list = Array.isArray(selectedNotes) ? [...selectedNotes] : [];
  if (!list.length) return [];

  const ordered = [...list].sort((a, b) => a.pitch - b.pitch);
  const bass = ordered[0];
  const uniquePcs = Array.from(new Set(ordered.map((n) => mod12(n.pc))));
  const raw = [];
  const seen = new Map();

  for (const rootPc of uniquePcs) {
    const preferSharps = preferSharpsFromMajorTonicPc(mod12(rootPc));
    const bassInterval = mod12(bass.pc - rootPc);
    const selectedIntervalsAll = Array.from(new Set(uniquePcs.map((pc) => mod12(pc - rootPc)))).sort((a, b) => a - b);

    for (const formula of CHORD_DETECT_FORMULAS) {
      const formulaIntervals = formula.intervals.map(mod12);
      const formulaSet = new Set(formulaIntervals);
      const externalBassInterval = formulaSet.has(bassInterval) ? null : bassInterval;
      const coreSelected = externalBassInterval == null ? selectedIntervalsAll : selectedIntervalsAll.filter((x) => x !== externalBassInterval);
      const extras = coreSelected.filter((x) => !formulaSet.has(x));
      if (extras.length) continue;
      if (!coreSelected.includes(0)) continue;

      const matches = formulaIntervals.filter((x) => coreSelected.includes(x));
      const missing = formulaIntervals.filter((x) => !coreSelected.includes(x));
      const minRequiredMatches = formula.allowDyad ? Math.min(formulaIntervals.length, 2) : Math.min(formulaIntervals.length, 3);
      if (matches.length < minRequiredMatches) continue;
      if (formula.allowDyad) {
        if (selectedIntervalsAll.length !== 2) continue;
        if (externalBassInterval != null) continue;
        if (missing.length > 0) continue;
      } else {
        if (missing.length > 1) continue;
      }

      const missingLabels = formulaIntervals
        .map((intv, idx) => !coreSelected.includes(intv) ? formula.degreeLabels[idx] : null)
        .filter(Boolean);
      const suffix = appendMissingDegreesToSuffix(formula.suffix, missingLabels);

      const buildCandidateNameForSpelling = (preferSharpsChoice) => {
        const rootNameChoice = pcToName(rootPc, preferSharpsChoice);
        const noteNamesChoice = spellChordNotes({ rootPc, chordIntervals: formulaIntervals, preferSharps: preferSharpsChoice });
        let slashBassChoice = "";
        if (bass.pc !== rootPc) {
          const bassIdx = formulaIntervals.findIndex((x) => x === bassInterval);
          const slashBassName = bassIdx >= 0
            ? noteNamesChoice[bassIdx]
            : spellNoteFromChordInterval(rootPc, bassInterval, preferSharpsChoice);
          slashBassChoice = `/${slashBassName}`;
        }
        return {
          name: `${rootNameChoice}${suffix}${slashBassChoice}`,
          noteNames: noteNamesChoice,
        };
      };

      const spellings = [
        { preferSharpsChoice: preferSharps, ...buildCandidateNameForSpelling(preferSharps) },
      ];
      const alternateSpelling = buildCandidateNameForSpelling(!preferSharps);
      if (alternateSpelling.name !== spellings[0].name) {
        spellings.push({ preferSharpsChoice: !preferSharps, ...alternateSpelling });
      }

      const exact = missing.length === 0;
      const slashPenalty = bass.pc === rootPc ? 0 : (externalBassInterval == null ? 1 : 3);
      const score = (exact ? 0 : 20) + slashPenalty + missing.length * 6 + Math.max(0, 4 - matches.length) + (formula.allowDyad ? 14 : 0);

      for (const spelling of spellings) {
        const noteNames = spelling.noteNames;
        const visiblePairs = formulaIntervals
          .map((intv, idx) => coreSelected.includes(intv) ? `${formula.degreeLabels[idx]}=${noteNames[idx]}` : null)
          .filter(Boolean);
        const visibleNotes = formulaIntervals
          .map((intv, idx) => coreSelected.includes(intv) ? noteNames[idx] : null)
          .filter(Boolean);
        const uiPatch = formula.allowDyad ? null : (formula.ui ? { rootPc, spellPreferSharps: spelling.preferSharpsChoice, ...formula.ui } : null);
        const candidate = {
          id: `${formula.id}|${rootPc}|${externalBassInterval == null ? "in" : externalBassInterval}|${missingLabels.join(",")}|${spelling.preferSharpsChoice ? "sharp" : "flat"}`,
          name: spelling.name,
          rootPc,
          bassPc: bass.pc,
          preferSharps: spelling.preferSharpsChoice,
          formula,
          exact,
          score,
          uiPatch,
          intervalPairsText: visiblePairs.join(", "),
          visibleNotes,
          visibleIntervals: matches,
          missingLabels,
          externalBassInterval,
        };

        candidate.probabilityScore = candidateProbabilityScore(candidate);

        const dedupeKey = `${candidate.name}|${candidate.intervalPairsText}`;
        const prev = seen.get(dedupeKey);
        if (!prev || candidate.probabilityScore < prev.probabilityScore || (candidate.probabilityScore === prev.probabilityScore && candidate.score < prev.score)) {
          seen.set(dedupeKey, candidate);
        }
      }
    }
  }

  raw.push(...seen.values());
  raw.push(...buildQuartalManualCandidates(selectedNotes));

  const exactSubsetSignatures = new Set(
    raw
      .filter((c) => c.exact)
      .map((c) => `${c.rootPc}|${c.bassPc}|${c.visibleIntervals.slice().sort((a, b) => a - b).join(",")}`)
  );

  const exactCandidates = raw.filter((c) => c.exact);
  const hasDirectExactDyad = exactCandidates.some((c) => c.formula?.allowDyad && c.externalBassInterval == null);

  const filtered = raw.filter((c) => {
    if (c.formula?.allowDyad) return true;
    if (hasDirectExactDyad && c.externalBassInterval != null) return false;
    if (c.missingLabels.some((x) => suffixSemanticallyContainsDegree(c.formula?.suffix, x))) return false;
    if (c.exact) {
      if (shouldFilterExactSubsetCandidate(c, exactCandidates)) return false;
      return true;
    }
    if (shouldFilterExternalBassSubsetCandidate(c, exactCandidates)) return false;
    if (c.missingLabels.some((x) => isThirdDegreeLabel(x))) {
      if (!allowMissingThirdCandidate(c)) return false;
    }
    if (c.missingLabels.length !== 1) return true;
    const missingLabel = c.missingLabels[0];
    if (!isExtensionLikeDegreeLabel(missingLabel)) return true;
    const sig = `${c.rootPc}|${c.bassPc}|${c.visibleIntervals.slice().sort((a, b) => a - b).join(",")}`;
    if (exactSubsetSignatures.has(sig)) return false;
    return true;
  });

  const hasCleanerExactCandidate = exactCandidates.some((c) => c.exact);
  filtered.forEach((c) => {
    let extraPenalty = 0;
    if (hasCleanerExactCandidate && candidateIsMissingThirdSeventhLike(c)) extraPenalty += 18;
    c.rankScore = Number(((c.probabilityScore ?? 999) + extraPenalty).toFixed(2));
  });

  filtered.sort((a, b) => {
    const groupPriority = (candidate) => {
      if (candidate?.formula?.quartal) {
        const quartalSize = Array.isArray(candidate?.formula?.intervals) ? candidate.formula.intervals.length : 0;
        return quartalSize >= 4 ? 2 : 3;
      }
      return 0;
    };

    const aGroup = groupPriority(a);
    const bGroup = groupPriority(b);
    if (aGroup !== bGroup) return aGroup - bGroup;

    if ((a.rankScore ?? 999) !== (b.rankScore ?? 999)) return (a.rankScore ?? 999) - (b.rankScore ?? 999);
    if (a.score !== b.score) return a.score - b.score;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
  return filtered.slice(0, 12);
}

function spellNoteFromChordInterval(rootPc, interval, preferSharps) {
  const rootName = pcToName(rootPc, preferSharps);
  const rootLetter = rootName[0];
  const rootIdx = Math.max(0, LETTERS.indexOf(rootLetter));
  const deg = chordDegreeNumberFromInterval(interval);
  const letter = LETTERS[(rootIdx + (deg - 1)) % 7];
  const pc = mod12(rootPc + interval);
  return spellPcWithLetter(pc, letter);
}

function buildDetectedCandidateNoteNameForPc(pc, candidate, preferSharpsFallback) {
  const prefer = candidate?.preferSharps ?? preferSharpsFallback;
  if (!candidate) return pcToName(pc, prefer);
  const interval = mod12(pc - candidate.rootPc);
  const idx = candidate.formula.intervals.findIndex((x) => mod12(x) === interval);
  if (idx >= 0) {
    const spelled = spellChordNotes({ rootPc: candidate.rootPc, chordIntervals: candidate.formula.intervals, preferSharps: prefer });
    return spelled[idx];
  }
  return spellNoteFromChordInterval(candidate.rootPc, interval, prefer);
}

function buildDetectedCandidateLabelForPc(pc, candidate, preferSharpsFallback, showIntervals = true, showNotes = true) {
  const noteName = buildDetectedCandidateNoteNameForPc(pc, candidate, preferSharpsFallback);
  if (!candidate) return noteName;

  const interval = mod12(pc - candidate.rootPc);
  const idx = candidate.formula.intervals.findIndex((x) => mod12(x) === interval);
  const degree = idx >= 0
    ? candidate.formula.degreeLabels[idx]
    : intervalToSimpleChordDegreeToken(interval);

  if (!showIntervals && !showNotes) return degree;
  if (showIntervals && showNotes) return `${degree}-${noteName}`;
  if (showIntervals) return degree;
  return noteName;
}

function buildDetectedCandidateBackgroundLabelForPc(pc, candidate, preferSharpsFallback, showIntervals = true, showNotes = true) {
  if (!candidate) return pcToName(pc, preferSharpsFallback);

  const prefer = candidate.preferSharps ?? preferSharpsFallback;
  const interval = mod12(pc - candidate.rootPc);
  const degree = intervalToSimpleChordDegreeToken(interval);
  const noteName = spellNoteFromChordInterval(candidate.rootPc, interval, prefer);

  if (!showIntervals && !showNotes) return degree;
  if (showIntervals && showNotes) return `${degree}-${noteName}`;
  if (showIntervals) return degree;
  return noteName;
}

function buildDetectedCandidateRoleForPc(pc, candidate) {
  if (!candidate) return "other";
  const interval = mod12(pc - candidate.rootPc);
  return detectFormulaRole(candidate.formula, interval);
}

function buildManualSelectionVoicing(selectedNotes, rootPc, maxFret) {
  if (!Array.isArray(selectedNotes) || !selectedNotes.length) return null;
  const fretsLH = [null, null, null, null, null, null];
  for (const n of selectedNotes) {
    if (!n) continue;
    fretsLH[5 - n.sIdx] = n.fret;
  }
  return buildVoicingFromFretsLH({ fretsLH, rootPc, maxFret });
}

function buildCloseTetradAbsoluteOrders(thirdOffset, fifthOffset, seventhOffset) {
  const t = mod12(thirdOffset);
  const f = mod12(fifthOffset);
  const s = mod12(seventhOffset);
  return {
    root: [0, t, f, s],
    "1": [t, f, s, 12],
    "2": [f, s, 12, 12 + t],
    "3": [s, 12, 12 + t, 12 + f],
  };
}

function applyDropToAbsoluteOrder(absOrder, dropKind) {
  const arr = [...absOrder];
  if (dropKind === "drop2") arr[2] -= 12;
  else if (dropKind === "drop3") arr[1] -= 12;
  else if (dropKind === "drop24") {
    arr[2] -= 12;
    arr[0] -= 12;
  }
  return arr.sort((a, b) => a - b);
}

function dropInversionLabelFromBassInt(bassInt, thirdOffset, fifthOffset, seventhOffset) {
  const b = mod12(bassInt);
  if (b === 0) return "Fundamental";
  if (b === mod12(thirdOffset)) return "1ª inv.";
  if (b === mod12(fifthOffset)) return "2ª inv.";
  if (b === mod12(seventhOffset)) return "3ª inv.";
  return `Inv. ${b}`;
}

function dropKindFromForm(form) {
  if (String(form).startsWith("drop24")) return "drop24";
  if (String(form).startsWith("drop3")) return "drop3";
  return "drop2";
}

function getDropAbsoluteOrder({ thirdOffset, fifthOffset, seventhOffset, dropKind, inversion }) {
  const t = mod12(thirdOffset);
  const f = mod12(fifthOffset);
  const s = mod12(seventhOffset);
  const inv = ["root", "1", "2", "3"].includes(inversion) ? inversion : "root";

  // Convenio de esta app: la inversión se nombra por el BAJO REAL del drop resultante.
  // Drop 2:
  // Fundamental = 1-5-7-3
  // 1ª inv.    = 3-7-1-5
  // 2ª inv.    = 5-1-3-7
  // 3ª inv.    = 7-3-5-1
  if (dropKind === "drop2") {
    if (inv === "root") return [0, f, s, 12 + t];
    if (inv === "1") return [t, s, 12, 12 + f];
    if (inv === "2") return [f, 12, 12 + t, 12 + s];
    return [s, 12 + t, 12 + f, 24];
  }

  // Drop 3:
  // Fundamental = 1-7-3-5
  // 1ª inv.    = 3-1-5-7
  // 2ª inv.    = 5-3-7-1
  // 3ª inv.    = 7-5-1-3
  if (dropKind === "drop3") {
    if (inv === "root") return [0, s, 12 + t, 12 + f];
    if (inv === "1") return [t, 12, 12 + f, 12 + s];
    if (inv === "2") return [f, 12 + t, 12 + s, 24];
    return [s, 12 + f, 24, 24 + t];
  }

  // Drop 2+4:
  // Fundamental = 1-5-3-7
  // 1ª inv.    = 3-7-5-1
  // 2ª inv.    = 5-1-7-3
  // 3ª inv.    = 7-3-1-5
  if (dropKind === "drop24") {
    if (inv === "root") return [0, f, 12 + t, 12 + s];
    if (inv === "1") return [t, s, 12 + f, 24];
    if (inv === "2") return [f, 12, 12 + s, 24 + t];
    return [s, 12 + t, 24, 24 + f];
  }

  const closeMap = buildCloseTetradAbsoluteOrders(thirdOffset, fifthOffset, seventhOffset);
  return applyDropToAbsoluteOrder(closeMap[inv], dropKind);
}

function generateDropTetradVoicings({ rootPc, thirdOffset, fifthOffset, seventhOffset, form, inversion = "root", maxFret, maxSpan = 6 }) {
  const setDefs = DROP_FORM_STRING_SETS[form] || [];
  if (!setDefs.length) return [];

  const dropKind = dropKindFromForm(form);
  const invMap = { root: 0, "1": 1, "2": 2, "3": 3 };
  const wantedInvIdx = invMap[inversion] ?? 0;
  const absOrderBase = getDropAbsoluteOrder({
    thirdOffset,
    fifthOffset,
    seventhOffset,
    dropKind,
    inversion,
  });

  const out = [];
  const seen = new Set();

  for (const set of setDefs) {
    const stringsLowToHigh = [...set].sort((a, b) => b - a);
    const pcsLowToHigh = absOrderBase.map((x) => mod12(rootPc + x));

    const lowerK = Math.max(...stringsLowToHigh.map((sIdx, i) => OPEN_MIDI[sIdx] - absOrderBase[i]));
    const upperK = Math.min(...stringsLowToHigh.map((sIdx, i) => OPEN_MIDI[sIdx] + maxFret - absOrderBase[i]));

    for (let K = lowerK; K <= upperK; K++) {
      const fretsPerLowToHigh = [];
      const pitches = [];
      let ok = true;

      for (let i = 0; i < 4; i++) {
        const targetPitch = K + absOrderBase[i];
        const sIdx = stringsLowToHigh[i];
        const fret = targetPitch - OPEN_MIDI[sIdx];
        if (!Number.isInteger(fret) || fret < 0 || fret > maxFret) {
          ok = false;
          break;
        }
        fretsPerLowToHigh.push({ sIdx, fret, targetPitch, pc: pcsLowToHigh[i] });
        pitches.push(targetPitch);
      }
      if (!ok) continue;

      for (let i = 1; i < pitches.length; i++) {
        if (pitches[i] <= pitches[i - 1]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      const span = frettedSpanFromFrets(fretsPerLowToHigh.map((x) => x.fret));
      if (span > maxSpan) continue;

      const fretsLH = [null, null, null, null, null, null];
      for (const n of fretsPerLowToHigh) fretsLH[5 - n.sIdx] = n.fret;

      const v = buildVoicingFromFretsLH({ fretsLH, rootPc, maxFret });
      if (!v || !isErgonomicVoicing(v, maxSpan)) continue;
      if (v.notes.length !== 4) continue;

      const rel = new Set(v.notes.map((n) => mod12(n.pc - rootPc)));
      if (![0, mod12(thirdOffset), mod12(fifthOffset), mod12(seventhOffset)].every((x) => rel.has(x))) continue;

      const lowToHighActual = [...v.notes]
        .sort((a, b) => pitchAt(a.sIdx, a.fret) - pitchAt(b.sIdx, b.fret))
        .map((n) => mod12(n.pc - rootPc));

      const expected = absOrderBase.map((x) => mod12(x));
      if (lowToHighActual.join(",") !== expected.join(",")) continue;

      const bassInt = mod12(v.bassPc - rootPc);
      const invLabel = dropInversionLabelFromBassInt(bassInt, thirdOffset, fifthOffset, seventhOffset);
      const key = `${form}|${inversion}|${v.frets}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        ...v,
        span,
        _form: form,
        _dropInvIdx: wantedInvIdx,
        _dropInvLabel: invLabel,
      });
    }
  }

  out.sort((a, b) => (a.minFret - b.minFret) || (a.maxFret - b.maxFret) || (a.span - b.span));
  return out;
}

// --------------------------------------------------------------------------
// BLOQUE: OPCIONES DE UI PARA ACORDES
// --------------------------------------------------------------------------

const CHORD_QUALITIES = [
  { value: "maj", label: "Mayor" },
  { value: "dom", label: "Dominante (7)" },
  { value: "min", label: "Menor" },
  { value: "dim", label: "Disminuido" },
  { value: "hdim", label: "m7(b5)" },
];

const CHORD_STRUCTURES = [
  { value: "triad", label: "Triada" },
  { value: "tetrad", label: "Cuatriada" },
  { value: "chord", label: "Acorde" },
];

const CHORD_FAMILIES = [
  { value: "tertian", label: "Terciaria" },
  { value: "quartal", label: "Cuartal" },
  { value: "guide_tones", label: "Notas guía" },
];

const CHORD_QUARTAL_TYPES = [
  { value: "pure", label: "Cuartal puro" },
  { value: "mixed", label: "Cuartal mixto" },
];

const CHORD_QUARTAL_VOICES = [
  { value: "3", label: "3 voces" },
  { value: "4", label: "4 voces" },
  { value: "5", label: "5 voces" },
];

const CHORD_QUARTAL_SPREADS = [
  { value: "closed", label: "Cerrado" },
  { value: "open", label: "Abierto" },
];

const CHORD_QUARTAL_REFERENCES = [
  { value: "root", label: "Desde raíz" },
  { value: "scale", label: "Diatónico a escala" },
];

const CHORD_QUARTAL_SCALE_NAMES = Object.keys(SCALE_PRESETS).filter((name) => name !== "Personalizada");

const CHORD_GUIDE_TONE_QUALITIES = [
  { value: "maj7", label: "Maj7" },
  { value: "min7", label: "m7" },
  { value: "dom7", label: "7" },
  { value: "maj6", label: "6" },
];

const CHORD_GUIDE_TONE_FORMS = [
  { value: "closed", label: "Cerrado" },
  { value: "open", label: "Abierto" },
];

const CHORD_GUIDE_TONE_INVERSIONS = [
  { value: "root", label: "Fundamental" },
  { value: "1", label: "1ª inversión" },
  { value: "2", label: "2ª inversión" },
  { value: "all", label: "Todas" },
];

function guideToneDefinitionFromQuality(quality) {
  switch (quality) {
    case "min7":
      return { quality, intervals: [0, 3, 10], degreeLabels: ["1", "b3", "b7"], suffix: "m7" };
    case "dom7":
      return { quality, intervals: [0, 4, 10], degreeLabels: ["1", "3", "b7"], suffix: "7" };
    case "maj6":
      return { quality, intervals: [0, 4, 9], degreeLabels: ["1", "3", "6"], suffix: "6" };
    case "maj7":
    default:
      return { quality: "maj7", intervals: [0, 4, 11], degreeLabels: ["1", "3", "7"], suffix: "maj7" };
  }
}

function guideToneBassIntervalsForSelection(definition, inversion) {
  const ints = Array.isArray(definition?.intervals) ? definition.intervals.map(mod12) : [0, 4, 11];
  const selected = inversion === "all" ? ["root", "1", "2"] : [inversion];
  return Array.from(new Set(selected.map((inv) => {
    if (inv === "1") return ints[1] ?? 0;
    if (inv === "2") return ints[2] ?? 0;
    return ints[0] ?? 0;
  }).map(mod12)));
}

function voicingHasOpenStrings(voicing) {
  return Array.isArray(voicing?.notes) && voicing.notes.some((n) => Number(n?.fret) === 0);
}

const QUARTAL_OPEN_STRING_PCS = [4, 11, 7, 2, 9, 4];
const QUARTAL_OPEN_STRING_MIDI = [64, 59, 55, 50, 45, 40];
const QUARTAL_PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function fnBuildQuartalNoteName(vPc) {
  return QUARTAL_PC_NAMES[mod12(vPc)] || "?";
}

function fnBuildQuartalDegreeLabel(vDegree) {
  if (typeof vDegree !== "number") return "";
  return `grado ${romanizeDegreeNumber(vDegree + 1)}`;
}

function fnBuildQuartalVoicingNotes(vStringIndices, vFrets, vMidis, vOrderedPcs) {
  return vStringIndices.map((vStringIdx, vIdx) => {
    const vFret = vFrets[vIdx];
    const vMidi = vMidis[vIdx];
    const vPc = mod12(vOrderedPcs[vIdx]);
    const vName = fnBuildQuartalNoteName(vPc);
    return {
      sIdx: vStringIdx,
      stringIndex: vStringIdx,
      stringIdx: vStringIdx,
      string: vStringIdx + 1,
      fret: vFret,
      midi: vMidi,
      pc: vPc,
      pitchClass: vPc,
      noteName: vName,
      name: vName,
      label: vName,
      isOpen: vFret === 0,
    };
  });
}

function fnBuildIndexCombinations(vLength, vChoose) {
  const vResult = [];
  function fnWalk(vStart, vAcc) {
    if (vAcc.length === vChoose) {
      vResult.push([...vAcc]);
      return;
    }
    for (let i = vStart; i < vLength; i += 1) {
      vAcc.push(i);
      fnWalk(i + 1, vAcc);
      vAcc.pop();
    }
  }
  fnWalk(0, []);
  return vResult;
}

function fnBuildQuartalPitchSets({ rootPc, voices, type, reference, scaleName = "Mayor" }) {
  const vVoices = Math.max(3, Math.min(5, parseInt(String(voices), 10) || 4));
  const vMap = new Map();
  const fnPush = (vPcs, vMeta = {}) => {
    const vNorm = vPcs.map((v) => mod12(v));
    const vKey = vNorm.join("-");
    if (!vMap.has(vKey)) vMap.set(vKey, { pcs: vNorm, ...vMeta });
  };

  if (reference === "scale") {
    const vScaleIntervalsRaw = buildScaleIntervals(scaleName, "", rootPc);
    const vScaleIntervals = Array.isArray(vScaleIntervalsRaw) ? vScaleIntervalsRaw.map((v) => mod12(v)) : [];
    const vScale = vScaleIntervals.map((v) => mod12(rootPc + v));
    const vScaleLen = vScale.length;

    if (vScaleLen >= 3) {
      for (let vDegree = 0; vDegree < vScaleLen; vDegree += 1) {
        const vPcs = [];
        for (let i = 0; i < vVoices; i += 1) vPcs.push(vScale[(vDegree + i * 3) % vScaleLen]);
        const vSteps = [];
        for (let i = 0; i < vPcs.length - 1; i += 1) vSteps.push(mod12(vPcs[i + 1] - vPcs[i]));
        const vPure = vSteps.every((v) => v === 5);
        if ((type === "pure" && vPure) || (type === "mixed" && !vPure)) {
          fnPush(vPcs, { degree: vDegree, steps: vSteps, scaleName });
        }
      }
    }
  } else if (type === "pure") {
    fnPush(Array.from({ length: vVoices }, (_, i) => mod12(rootPc + i * 5)), { steps: Array.from({ length: Math.max(0, vVoices - 1) }, () => 5) });
  } else {
    for (let vAlteredIdx = 0; vAlteredIdx < vVoices - 1; vAlteredIdx += 1) {
      const vPcs = [mod12(rootPc)];
      let vCursor = mod12(rootPc);
      const vSteps = [];
      for (let i = 0; i < vVoices - 1; i += 1) {
        const vStep = i === vAlteredIdx ? 6 : 5;
        vSteps.push(vStep);
        vCursor = mod12(vCursor + vStep);
        vPcs.push(vCursor);
      }
      fnPush(vPcs, { alteredIndex: vAlteredIdx, steps: vSteps });
    }
  }

  if (!vMap.size && reference !== "scale") {
    fnPush(Array.from({ length: vVoices }, (_, i) => mod12(rootPc + i * 5)), { fallback: true, steps: Array.from({ length: Math.max(0, vVoices - 1) }, () => 5) });
  }

  return Array.from(vMap.values());
}

function fnBuildQuartalFretString(vStringIndices, vFrets) {
  const vOut = ["x", "x", "x", "x", "x", "x"];
  vStringIndices.forEach((vStringIdx, vIdx) => {
    vOut[5 - vStringIdx] = String(vFrets[vIdx]);
  });
  return vOut.join("");
}

function fnGetQuartalSpreadKind(vMidis, vSteps) {
  const vSafeMidis = Array.isArray(vMidis) ? vMidis : [];
  const vSafeSteps = Array.isArray(vSteps) ? vSteps : [];
  if (vSafeMidis.length < 2) return "closed";

  for (let i = 0; i < vSafeMidis.length - 1; i += 1) {
    const vDiff = vSafeMidis[i + 1] - vSafeMidis[i];
    const vExpected = Number(vSafeSteps[i] || 5);
    if (vDiff !== vExpected) return "open";
  }

  return "closed";
}

function fnGenerateQuartalVoicings({ pitchSets, maxDist, allowOpenStrings, maxFret }) {
  const vCombos = [
    ...fnBuildIndexCombinations(6, 3),
    ...fnBuildIndexCombinations(6, 4),
    ...fnBuildIndexCombinations(6, 5),
  ];
  const vWantedSizes = new Set(pitchSets.map((v) => v.pcs.length));
  const vResults = [];
  const vSeen = new Set();
  const vMaxDist = Math.max(4, Math.min(8, Number(maxDist) || 5));
  const vMinFret = allowOpenStrings ? 0 : 1;
  const vMaxFret = Math.max(4, Math.min(24, Number(maxFret) || 15));

  for (const vPitchSet of pitchSets) {
    const vOrderedPcs = Array.isArray(vPitchSet?.pcs) ? [...vPitchSet.pcs] : [];
    if (!vOrderedPcs.length) continue;

    for (const vCombo of vCombos) {
      if (!vWantedSizes.has(vCombo.length) || vCombo.length !== vOrderedPcs.length) continue;

      const vStrings = [...vCombo].sort((a, b) => b - a);
      const vCandidates = vStrings.map((vStringIdx, vIdx) => {
        const vTargetPc = vOrderedPcs[vIdx];
        const vOpenPc = QUARTAL_OPEN_STRING_PCS[vStringIdx];
        const vOpenMidi = QUARTAL_OPEN_STRING_MIDI[vStringIdx];
        const vList = [];
        for (let vFret = vMinFret; vFret <= vMaxFret; vFret += 1) {
          if (mod12(vOpenPc + vFret) !== vTargetPc) continue;
          vList.push({ fret: vFret, midi: vOpenMidi + vFret });
        }
        return vList;
      });
      if (vCandidates.some((v) => !v.length)) continue;

      const fnWalk = (vIdx, vFrets, vMidis) => {
        if (vIdx === vCandidates.length) {
          const vPositive = vFrets.filter((v) => v > 0);
          const vMin = vPositive.length ? Math.min(...vPositive) : 0;
          const vMax = vPositive.length ? Math.max(...vPositive) : 0;
          const vReach = vPositive.length ? (vMax - vMin + 1) : 1;
          if (vReach > vMaxDist) return;

          const vSpreadKind = fnGetQuartalSpreadKind(vMidis, vPitchSet.steps);
          const vFretsText = fnBuildQuartalFretString(vStrings, vFrets);
          const vKey = `${vFretsText}|${vPitchSet.pcs.join("-")}|${vSpreadKind}`;
          if (vSeen.has(vKey)) return;
          vSeen.add(vKey);

          const vNotes = fnBuildQuartalVoicingNotes(vStrings, vFrets, vMidis, vOrderedPcs);
          const vBass = vNotes.length
            ? [...vNotes].sort((a, b) => a.midi - b.midi)[0]
            : null;

          vResults.push({
            frets: vFretsText,
            span: Math.max(0, vMax - vMin),
            reach: vReach,
            notes: vNotes,
            bassKey: vBass ? `${vBass.sIdx}:${vBass.fret}` : null,
            bassPc: vBass ? vBass.pc : null,
            minFret: vMin,
            maxFret: vMax,
            pitchSpan: vMidis.length ? (Math.max(...vMidis) - Math.min(...vMidis)) : 0,
            quartalPcs: [...vPitchSet.pcs],
            quartalOrderedPcs: [...vOrderedPcs],
            quartalRotation: 0,
            quartalSpreadKind: vSpreadKind,
            quartalSteps: Array.isArray(vPitchSet.steps) ? [...vPitchSet.steps] : [],
            quartalDegree: typeof vPitchSet.degree === "number" ? vPitchSet.degree : null,
            quartalReference: vPitchSet.reference || null,
          });
          return;
        }

        for (const vCandidate of vCandidates[vIdx]) {
          if (vMidis.length && vCandidate.midi <= vMidis[vMidis.length - 1]) continue;
          vFrets.push(vCandidate.fret);
          vMidis.push(vCandidate.midi);
          fnWalk(vIdx + 1, vFrets, vMidis);
          vFrets.pop();
          vMidis.pop();
        }
      };

      fnWalk(0, [], []);
    }
  }

  vResults.sort((a, b) => {
    if ((a.minFret ?? 0) !== (b.minFret ?? 0)) return (a.minFret ?? 0) - (b.minFret ?? 0);
    if ((a.reach ?? 0) !== (b.reach ?? 0)) return (a.reach ?? 0) - (b.reach ?? 0);
    return String(a.frets || "").localeCompare(String(b.frets || ""));
  });

  return vResults;
}

const CHORD_INVERSIONS = [
  { value: "root", label: "Fundamental" },
  { value: "1", label: "1ª inversión" },
  { value: "2", label: "2ª inversión" },
  { value: "3", label: "3ª inversión" },
  { value: "all", label: "Todas" },
];

const CHORD_FORMS = [
  { value: "closed", label: "Cerrado" },
  { value: "open", label: "Abierto" },
  { value: "drop2_set1", label: "Drop 2 Set 1" },
  { value: "drop2_set2", label: "Drop 2 Set 2" },
  { value: "drop2_set3", label: "Drop 2 Set 3" },
  { value: "drop3_set1", label: "Drop 3 Set 1" },
  { value: "drop3_set2", label: "Drop 3 Set 2" },
  { value: "drop24_set1", label: "Drop 2+4 Set 1" },
  { value: "drop24_set2", label: "Drop 2+4 Set 2" },
];

const DROP_FORM_OPTIONS = [
  { value: "none", label: "—" },
  ...CHORD_FORMS.filter((x) => isDropForm(x.value)),
];

const DROP_FORM_STRING_SETS = {
  drop2_set1: [[0, 1, 2, 3]],
  drop2_set2: [[1, 2, 3, 4]],
  drop2_set3: [[2, 3, 4, 5]],
  drop3_set1: [[0, 1, 2, 4]],
  drop3_set2: [[1, 2, 3, 5]],
  drop24_set1: [[0, 1, 3, 4]],
  drop24_set2: [[1, 2, 4, 5]],
};

function buildChordIntervals({ quality, suspension, structure, ext7, ext6, ext9, ext11, ext13 }) {
  const sus = suspension || "none";
  const third = sus === "sus2" ? 2 : sus === "sus4" ? 5 : quality === "maj" || quality === "dom" ? 4 : 3;
  const fifth = sus !== "none" ? 7 : quality === "dim" || quality === "hdim" ? 6 : 7;

  const out = [0, third, fifth];

  // CUATRIADA "teórica":
  // - Por defecto incluye 7ª.
  // - Si activas 6/9/11/13 (solo una), se convierte en add6/add9/add11/add13 (sin 7ª).
  if (structure === "tetrad") {
    const addCount = (ext6 ? 1 : 0) + (ext9 ? 1 : 0) + (ext11 ? 1 : 0) + (ext13 ? 1 : 0);
    if (addCount) {
      const addInt = ext13 ? 9 : ext11 ? 5 : ext9 ? 2 : 9; // ext6 por defecto
      out.push(addInt);
      return Array.from(new Set(out.map(mod12))).sort((a, b) => a - b);
    }
  }

  // 7ª
  const wants7 = structure !== "triad";
  if (wants7) {
    let seventh = 10;
    if (quality === "maj") seventh = 11; // maj7
    if (quality === "dim") seventh = 9; // dim7 (bb7)
    if (quality === "hdim") seventh = 10; // ø7

    // en "Acorde" se puede desactivar 7 con el checkbox
    if (!(structure === "chord" && ext7 === false) && !(structure === "tetrad" && ext7 === false)) {
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

  // extensiones (en "Acorde" sí pueden coexistir)
  if (structure === "chord") {
    if (ext6) out.push(9);
    if (ext9) out.push(2);
    if (ext11) out.push(5);
    if (ext13) out.push(9);
  }

  // add6 en triada
  if (structure === "triad" && ext6) out.push(9);

  return Array.from(new Set(out.map(mod12))).sort((a, b) => a - b);
}

function seventhOffsetForQuality(quality) {
  if (quality === "maj") return 11;
  if (quality === "dim") return 9;
  // min/dom/hdim
  return 10;
}

function chordBassInterval({ quality, suspension, structure, inversion, chordIntervals, ext7, ext6, ext9, ext11, ext13 }) {
  const sus = suspension || "none";
  const third = sus === "sus2" ? 2 : sus === "sus4" ? 5 : quality === "maj" || quality === "dom" ? 4 : 3;
  const fifth = sus !== "none" ? 7 : quality === "dim" || quality === "hdim" ? 6 : 7;

  const has7 = !!ext7;
  let degrees = [0, third, fifth];

  if (has7) {
    const seventh = seventhOffsetForQuality(quality);
    degrees = [0, third, fifth, seventh];
  } else if (structure !== "triad") {
    // cuatriada/chord sin 7ª: el 4º grado será add6/add9/add11/add13 (si existe)
    const addInt = ext13 ? 9 : ext11 ? 5 : ext9 ? 2 : ext6 ? 9 : null;
    if (addInt != null) degrees = [0, third, fifth, addInt];
  }

  if (inversion === "1") return degrees[1] ?? 0;
  if (inversion === "2") return degrees[2] ?? 0;
  if (inversion === "3") return degrees[3] ?? degrees[0];
  return degrees[0];
}

function intervalToChordToken(semi, { ext6, ext9, ext11, ext13 }) {
  const s = mod12(semi);

  // En contexto de acordes preferimos el deletreo funcional del acorde.
  // Ej.: m7(b5) debe mostrar b5, no #4.
  if (s === 6) return "b5";

  const base = intervalToDegreeToken(s);

  // Para acordes mostramos 6/9/11/13 solo en su grado natural.
  if (ext13 && s === 9) return "13";
  if (ext11 && s === 5) return "11";
  if (ext9 && s === 2) return "9";
  if (ext6 && s === 9) return "6";

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

function chordDegreeNumberFromInterval(interval) {
  const s = mod12(interval);
  if (s === 0) return 1;
  if (s === 1 || s === 2) return 2;
  if (s === 3 || s === 4) return 3;
  if (s === 5) return 4;
  if (s === 6 || s === 7) return 5;
  if (s === 8 || s === 9) return 6;
  if (s === 10 || s === 11) return 7;
  return 1;
}

function spellChordNotes({ rootPc, chordIntervals, preferSharps }) {
  const rootName = pcToName(rootPc, preferSharps);
  const rootLetter = rootName[0];
  const rootIdx = Math.max(0, LETTERS.indexOf(rootLetter));

  return chordIntervals.map((interval) => {
    const deg = chordDegreeNumberFromInterval(interval);
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

function normalizeScaleName(name) {
  return SCALE_NAME_ALIASES[name] || name;
}

function scaleOptionLabel(name) {
  const ints = SCALE_PRESETS[name];
  if (!Array.isArray(ints)) return name;
  return `${name} (${ints.map((i) => intervalToDegreeToken(i)).join(" ")})`;
}

function buildScaleIntervals(scaleName, customInput, rootPc) {
  const preset = SCALE_PRESETS[normalizeScaleName(scaleName)];
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

const FRET_CELL_BG = "rgba(248, 250, 252, 0.72)";

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

// --------------------------------------------------------------------------
// BLOQUE: ARMADURA / AUTO-NOTACIÓN (# / b)
// --------------------------------------------------------------------------

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

  if (scaleName === "Mayor") return rootPc;
  if (scaleName === "Pentatónica mayor") return rootPc;

  // Menores: armadura de la relativa mayor
  if (scaleName === "Menor natural" || scaleName === "Pentatónica menor") {
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

const MAJOR_KEY_SIGNATURES = {
  0: { type: null, count: 0 },
  7: { type: "sharp", count: 1 },
  2: { type: "sharp", count: 2 },
  9: { type: "sharp", count: 3 },
  4: { type: "sharp", count: 4 },
  11: { type: "sharp", count: 5 },
  6: { type: "sharp", count: 6 },
  1: { type: "flat", count: 5 },
  5: { type: "flat", count: 1 },
  10: { type: "flat", count: 2 },
  3: { type: "flat", count: 3 },
  8: { type: "flat", count: 4 },
};

const SCALE_NAMES_WITH_KEY_SIGNATURE = new Set([
  "Mayor",
  "Menor natural",
  "Menor armónica",
  "Menor melódica (asc)",
  "Pentatónica mayor",
  "Pentatónica menor",
  "Pentatónica mayor + blue note",
  "Pentatónica menor + blue note",
  "Jónica (Ionian)",
  "Dórica (Dorian)",
  "Frigia (Phrygian)",
  "Lidia (Lydian)",
  "Mixolidia (Mixolydian)",
  "Eólica (Aeolian)",
  "Locria (Locrian)",
]);

function keySignatureParentMajorTonicPc({ rootPc, scaleName }) {
  const normalized = normalizeScaleName(scaleName);
  if (!SCALE_NAMES_WITH_KEY_SIGNATURE.has(normalized)) return null;
  if (normalized === "Menor armónica" || normalized === "Menor melódica (asc)") return mod12(rootPc + 3);
  if (normalized === "Pentatónica mayor + blue note") return rootPc;
  if (normalized === "Pentatónica menor + blue note") return mod12(rootPc + 3);
  return getParentMajorTonicPc({ rootPc, scaleName: normalized });
}

function resolveKeySignatureForScale({ rootPc, scaleName }) {
  const parentMajorPc = keySignatureParentMajorTonicPc({ rootPc, scaleName });
  if (parentMajorPc == null) return null;
  const spec = MAJOR_KEY_SIGNATURES[parentMajorPc];
  if (!spec || !spec.count) return { type: null, count: 0, tonicPc: parentMajorPc };
  return { ...spec, tonicPc: parentMajorPc };
}

// --------------------------------------------------------------------------
// BLOQUE: PATRONES Y FORMAS SOBRE EL MÁSTIL
// --------------------------------------------------------------------------

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

      // 2 por cuerda, 6ª->1ª
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

      // 3 por cuerda, 6ª->1ª (sIdx 5..0)
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

// --------------------------------------------------------------------------
// BLOQUE: PATRONES COMO INSTANCIAS (para rutas y continuidad)
// --------------------------------------------------------------------------

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

// --------------------------------------------------------------------------
// BLOQUE: CAGED
// --------------------------------------------------------------------------

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

// --------------------------------------------------------------------------
// BLOQUE: CAJAS PENTATÓNICAS
// --------------------------------------------------------------------------

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

// ============================================================================
// RUTA MUSICAL
// ============================================================================

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

function cleanUiText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function nearestControlLabel(el) {
  let node = el;
  while (node && node !== document.body) {
    const wrappingLabel = node.closest && node.closest("label");
    const wrappingText = cleanUiText((wrappingLabel && wrappingLabel.textContent) || "");
    if (wrappingText) return wrappingText;

    const parent = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const idx = siblings.indexOf(node);
      for (let i = idx - 1; i >= 0; i--) {
        const sib = siblings[i];
        const direct = sib.matches && sib.matches("label") ? sib : null;
        const nested = sib.querySelector ? sib.querySelector("label") : null;
        const text = cleanUiText(((direct || nested) && (direct || nested).textContent) || "");
        if (text) return text;
      }
    }

    node = node.parentElement;
  }
  return "";
}

function inferControlTitle(el) {
  const existing = cleanUiText(el.getAttribute && el.getAttribute("title"));
  if (existing) return existing;

  const tag = String(el.tagName || "").toLowerCase();
  const type = String((el.getAttribute && el.getAttribute("type")) || "").toLowerCase();
  const ownText = cleanUiText(el.textContent || "");
  const label = nearestControlLabel(el);
  const labelNorm = cleanUiText(label).toLowerCase();

  if (tag === "select") {
    if (labelNorm.startsWith("nota raíz")) return "Elige la tónica de la escala.";
    if (labelNorm === "escala") return "Selecciona la escala o modo activo.";
    if (labelNorm === "trastes") return "Define hasta qué traste se muestra el mástil.";
    if (labelNorm === "tono") return "Elige la nota base del acorde.";
    if (labelNorm.startsWith("calidad")) return "Elige la calidad del acorde y, si quieres, una suspensión.";
    if (labelNorm === "estructura") return "Elige si trabajas con 3, 4 o más notas.";
    if (labelNorm === "forma") return "Elige la disposición del acorde: cerrado, abierto o drop.";
    if (labelNorm.startsWith("inversión")) return "Elige qué nota del acorde queda en el bajo.";
    if (labelNorm.startsWith("voicing")) return "Selecciona una digitación concreta del acorde actual.";
    if (labelNorm.startsWith("digitación en rango")) return "Selecciona una digitación dentro del rango de trastes.";
    if (labelNorm === "dist.") return "Limita la distancia máxima entre el primer y el último traste.";
    if (labelNorm === "modo ruta") return "Define cómo se calcula la ruta musical.";
    if (labelNorm === "patrón") return "Fija un patrón concreto o deja la elección automática.";
    if (labelNorm.startsWith("máx. notas seguidas/cuerda")) return "Limita cuántas notas consecutivas puede tocar la ruta en una misma cuerda.";
    if (labelNorm === "inicio") return "Traste inicial del rango visible en acordes cercanos.";
    if (labelNorm === "tamaño") return "Cantidad de trastes que abarca el rango visible.";
    return label || "Seleccionar";
  }

  if (tag === "input" && type === "color") return label ? (label + ": elegir color") : "Elegir color";
  if (tag === "input" && type === "checkbox") {
    if (labelNorm.includes("permitir cuerdas al aire")) return "Permite usar cuerdas al aire como opción de voicing. La distancia se calcula solo con las notas pisadas.";
    return label || "Activar o desactivar";
  }
  if (tag === "input") return label || "Introducir valor";

  if (tag === "button") {
    if (ownText === "Estudiar") return "Abre el análisis del acorde, del voicing y de sus tensiones.";
    if (ownText === "Auto") return "Deja que la aplicación elija automáticamente.";
    if (ownText === "Notas") return "Muestra el nombre de las notas.";
    if (ownText === "Intervalos") return "Muestra el grado o intervalo.";
    if (ownText === "Escala") return "Muestra u oculta el mástil de la escala.";
    if (ownText === "Patrones") return "Muestra u oculta el mástil de patrones.";
    if (ownText === "Ruta") return "Muestra u oculta el mástil de la ruta musical.";
    if (ownText === "Acordes") return "Muestra u oculta el panel de acordes.";
    if (ownText === "Ver todo") return "Muestra también las notas que no pertenecen a la escala.";
    if (ownText === "Extra ON" || ownText === "Extra OFF") return "Activa o desactiva las notas extra.";
    return label || ownText || "Botón";
  }

  return label || ownText || "";
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function sanitizeBoolValue(v, fallback) {
  return typeof v === "boolean" ? v : fallback;
}

function sanitizeNumberValue(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeOneOf(v, allowed, fallback) {
  return allowed.includes(v) ? v : fallback;
}

function sanitizeColorValue(v, fallback) {
  return typeof v === "string" && HEX_COLOR_RE.test(v) ? v : fallback;
}

function unwrapPersistedPayload(raw) {
  if (raw && typeof raw === "object" && raw.config && typeof raw.config === "object") {
    return {
      version: Number(raw.version) || 0,
      config: raw.config,
    };
  }
  return {
    version: 0,
    config: raw && typeof raw === "object" ? raw : {},
  };
}

function sanitizeNearSlotValue(value, fallback) {
  const slot = value && typeof value === "object" ? value : {};
  return {
    ...fallback,
    enabled: sanitizeBoolValue(slot.enabled, fallback.enabled),
    rootPc: sanitizeNumberValue(slot.rootPc, fallback.rootPc, 0, 11),
    quality: sanitizeOneOf(slot.quality, CHORD_QUALITIES.map((q) => q.value), fallback.quality),
    suspension: sanitizeOneOf(slot.suspension, ["none", "sus2", "sus4"], fallback.suspension),
    structure: sanitizeOneOf(slot.structure, CHORD_STRUCTURES.map((s) => s.value), fallback.structure),
    inversion: sanitizeOneOf(slot.inversion, CHORD_INVERSIONS.map((x) => x.value), fallback.inversion),
    form: sanitizeOneOf(slot.form, CHORD_FORMS.map((x) => x.value), fallback.form),
    positionForm: sanitizeOneOf(slot.positionForm, ["closed", "open"], positionFormFromEffectiveForm(slot.form, fallback.positionForm || "open")),
    ext7: sanitizeBoolValue(slot.ext7, fallback.ext7),
    ext6: sanitizeBoolValue(slot.ext6, fallback.ext6),
    ext9: sanitizeBoolValue(slot.ext9, fallback.ext9),
    ext11: sanitizeBoolValue(slot.ext11, fallback.ext11),
    ext13: sanitizeBoolValue(slot.ext13, fallback.ext13),
    spellPreferSharps: sanitizeBoolValue(slot.spellPreferSharps, fallback.spellPreferSharps),
    maxDist: sanitizeOneOf(Number(slot.maxDist), [4, 5, 6], fallback.maxDist),
    allowOpenStrings: sanitizeBoolValue(slot.allowOpenStrings, fallback.allowOpenStrings),
    selFrets: typeof slot.selFrets === "string" || slot.selFrets == null ? slot.selFrets : fallback.selFrets,
  };
}

function sanitizePresetCollection(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: QUICK_PRESET_COUNT }, (_, i) => {
    const item = arr[i];
    if (!item || typeof item !== "object") return null;
    const payload = unwrapPersistedPayload(item.payload || item).config;
    if (!payload || typeof payload !== "object") return null;
    return {
      name: typeof item.name === "string" && cleanUiText(item.name) ? cleanUiText(item.name).slice(0, 40) : `Preset ${i + 1}`,
      savedAt: typeof item.savedAt === "string" ? item.savedAt : "",
      payload: {
        version: UI_CONFIG_VERSION,
        appVersion: APP_VERSION,
        config: payload,
      },
    };
  });
}

const ROUTE_LAB_DEFAULT_TUNING = {
  sameStringDirectionalBonusNear: 1.35,
  sameStringDirectionalBonusFar: 0.7,
  switchWhenSameStringForwardPenalty: 3.1,
  worseThanSameStringGoalBase: 4.6,
  worseThanSameStringGoalScale: 1.75,
  corridorPenalty: 1.25,
  openStringWithAlternativePenalty: 4.2,
  overshootNearEndAlt: 8.5,
  overshootNearEndNoAlt: 4.0,
  overshootTwoStepsAlt: 5.5,
  overshootTwoStepsNoAlt: 2.4,
  overshootMidAlt: 3.0,
  overshootMidNoAlt: 1.2,
  templateStayBonus: 1.2,
  templateEnterBonus: 0.55,
  templateNeighborBonus: 0.4,
  templateMissPenalty: 1.1,
  resolveToGoalBonus: 1.8,
  lateStringBreakBonus: 2.8,
  lateSameStringPenalty: 6.5,
  lateOvershootPenalty: 10.5,
};

const ROUTE_LAB_FIXED_TESTS = [
  {
    id: "penta_major_f_63_110",
    label: "Penta mayor F · 63 \u2192 110",
    rootPc: 5,
    scaleName: "Pentatónica mayor",
    startCode: "63",
    endCode: "110",
    maxFret: 15,
    maxPerString: 4,
    checks: [
      { type: "excludeCode", code: "212", severity: "soft" },
      { type: "excludeCode", code: "412", severity: "soft" },
    ],
  },
  {
    id: "penta_major_f_11_110",
    label: "Penta mayor F · 11 \u2192 110",
    rootPc: 5,
    scaleName: "Pentatónica mayor",
    startCode: "11",
    endCode: "110",
    maxFret: 15,
    maxPerString: 4,
    checks: [],
  },
  {
    id: "major_f_11_112",
    label: "Mayor F · 11 \u2192 112",
    rootPc: 5,
    scaleName: "Mayor",
    startCode: "11",
    endCode: "112",
    maxFret: 15,
    maxPerString: 4,
    checks: [],
  },
  {
    id: "minor_natural_f_61_113",
    label: "Menor natural F · 61 \u2192 113",
    rootPc: 5,
    scaleName: "Menor natural",
    startCode: "61",
    endCode: "113",
    maxFret: 15,
    maxPerString: 4,
    checks: [],
  },
  {
    id: "blues_minor_f_61_17",
    label: "Blues menor F · 61 \u2192 17",
    rootPc: 5,
    scaleName: "Pentatónica menor + blue note",
    startCode: "61",
    endCode: "17",
    maxFret: 15,
    maxPerString: 4,
    checks: [],
  },
  {
    id: "bebop_major_f_10_63",
    label: "Bebop mayor F · 10 \u2192 63",
    rootPc: 5,
    scaleName: "Bebop mayor",
    startCode: "10",
    endCode: "63",
    maxFret: 15,
    maxPerString: 4,
    checks: [],
  },
];

const ROUTE_LAB_BENCHMARK_SPECS = [
  { scaleName: "Pentatónica mayor", rootPc: 5, maxFret: 15, maxPerString: 4, targetAsc: 12 },
  { scaleName: "Pentatónica menor", rootPc: 5, maxFret: 15, maxPerString: 4, targetAsc: 12 },
  { scaleName: "Mayor", rootPc: 5, maxFret: 15, maxPerString: 4, targetAsc: 12 },
  { scaleName: "Menor natural", rootPc: 5, maxFret: 15, maxPerString: 4, targetAsc: 12 },
  { scaleName: "Pentatónica menor + blue note", rootPc: 5, maxFret: 15, maxPerString: 4, targetAsc: 10 },
  { scaleName: "Bebop mayor", rootPc: 5, maxFret: 15, maxPerString: 4, targetAsc: 10 },
];

function routeLabTemplateFamily(scaleName, scaleIntervals) {
  const normalized = normalizeScaleName(scaleName || "");
  if (normalized.startsWith("Pentatónica") && scaleIntervals.length >= 5) return "penta";
  if (normalized.startsWith("Bebop")) return "bebop";
  if ((normalized === "Mayor" || normalized === "Menor natural") && scaleIntervals.length === 7) return "major_minor";
  return null;
}

function routeLabTemplateCorridorHits(cells, startPos, endPos) {
  const minString = Math.min(startPos.sIdx, endPos.sIdx);
  const maxString = Math.max(startPos.sIdx, endPos.sIdx);
  const minFret = Math.min(startPos.fret, endPos.fret) - 2;
  const maxFret = Math.max(startPos.fret, endPos.fret) + 2;
  let hits = 0;

  for (const cell of cells || []) {
    const [sStr, fStr] = String(cell).split(":");
    const sIdx = parseInt(sStr, 10);
    const fret = parseInt(fStr, 10);
    if (!Number.isFinite(sIdx) || !Number.isFinite(fret)) continue;
    if (sIdx < minString || sIdx > maxString) continue;
    if (fret < minFret || fret > maxFret) continue;
    hits += 1;
  }

  return hits;
}

function buildRouteLabTemplateContext({ rootPc, scaleName, scaleIntervals, maxFret, startPos, endPos }) {
  const family = routeLabTemplateFamily(scaleName, scaleIntervals);
  if (!family || !startPos || !endPos) {
    return { enabled: false, family: null, instances: [], preferredIds: new Set(), membership: new Map(), anchorById: new Map(), stringCountById: new Map() };
  }

  const instances = family === "penta"
    ? buildPentatonicBoxInstances({ rootPc, scaleIntervals, maxFret })
    : build3NpsPatternInstances({ rootPc, scaleIntervals, maxFret });

  if (!instances.length) {
    return { enabled: false, family, instances: [], preferredIds: new Set(), membership: new Map(), anchorById: new Map(), stringCountById: new Map() };
  }

  const startKey = `${startPos.sIdx}:${startPos.fret}`;
  const endKey = `${endPos.sIdx}:${endPos.fret}`;

  const ranked = instances
    .map((inst, idx) => {
      const anchor = inst.anchorFret ?? inst.rootFret ?? inst.windowStart ?? 0;
      const hasStart = inst.cells.has(startKey);
      const hasEnd = inst.cells.has(endKey);
      const corridorHits = routeLabTemplateCorridorHits(inst.cells, startPos, endPos);
      const startDist = Math.abs(anchor - startPos.fret);
      const endDist = Math.abs(anchor - endPos.fret);
      const score =
        (hasStart ? 10 : 0) +
        (hasEnd ? 8 : 0) +
        (corridorHits * 0.35) -
        (startDist * 0.55) -
        (endDist * 0.3);

      return { idx, anchor, score };
    })
    .sort((a, b) => b.score - a.score || a.anchor - b.anchor);

  const chosen = ranked.filter((item, idx) => item.score > 0 || idx < 3).slice(0, 4);
  if (!chosen.length && ranked.length) chosen.push(ranked[0]);

  const preferredIds = new Set(chosen.map((item) => item.idx));
  const membership = new Map();
  const anchorById = new Map();

  for (const item of chosen) {
    anchorById.set(item.idx, item.anchor);
    for (const cell of instances[item.idx].cells) {
      if (!membership.has(cell)) membership.set(cell, []);
      membership.get(cell).push(item.idx);
    }
  }

  for (const [cell, ids] of membership.entries()) {
    membership.set(cell, ids.sort((a, b) => a - b));
  }

    const stringCountById = new Map();
  for (const item of chosen) {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const cell of instances[item.idx].cells) {
      const [sStr] = String(cell).split(":");
      const sIdx = parseInt(sStr, 10);
      if (Number.isFinite(sIdx) && sIdx >= 0 && sIdx < 6) counts[sIdx] += 1;
    }
    stringCountById.set(item.idx, counts);
  }

  return {
    enabled: preferredIds.size > 0,
    family,
    instances,
    preferredIds,
    membership,
    anchorById,
    stringCountById,
  };
}

function inferRouteLabPreferredNotesPerString(scaleName, scaleIntervals, requestedMax) {
  const normalized = normalizeScaleName(scaleName || "");
  const requested = Math.max(1, Math.min(5, Number(requestedMax) || 3));

  const isCompactFamily = normalized.includes("Pentatónica") || normalized.includes("blue note") || scaleIntervals.length <= 6;
  const isLinearFamily = normalized.includes("Bebop") || scaleIntervals.length >= 7;

  let nativeTarget = requested;
  if (isCompactFamily) nativeTarget = 2;
  else if (isLinearFamily) nativeTarget = 3;

  const phraseTarget = nativeTarget;
  const softTarget = Math.min(4, Math.max(nativeTarget, requested));
  const hardLimit = Math.min(4, Math.max(softTarget, nativeTarget + 1));

  return {
    nativeTarget,
    requested,
    phraseTarget,
    softTarget,
    hardLimit,
  };
}

function routeLabCodesFromPath(path) {
  return (Array.isArray(path) ? path : []).map((n) => `${n.sIdx + 1}${n.fret}`);
}

function routeLabMaxRun(path) {
  const list = Array.isArray(path) ? path : [];
  if (!list.length) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < list.length; i++) {
    if (list[i].sIdx === list[i - 1].sIdx) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

function routeLabFretReversalCount(path) {
  const list = Array.isArray(path) ? path : [];
  let prevSign = 0;
  let count = 0;

  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const cur = list[i];
    const df = cur.fret - prev.fret;
    const ds = Math.abs(cur.sIdx - prev.sIdx);
    if (df === 0) continue;

    const sign = df > 0 ? 1 : -1;
    const guitaristicDiagonal = ds === 1 && Math.abs(df) <= 3;

    if (guitaristicDiagonal) continue;

    if (prevSign !== 0 && sign !== prevSign) count += 1;
    prevSign = sign;
  }

  return count;
}

function routeLabHasAdjacentSequence(codes, seq) {
  const list = Array.isArray(codes) ? codes : [];
  const wanted = Array.isArray(seq) ? seq : [];
  if (!wanted.length || wanted.length > list.length) return false;
  for (let i = 0; i <= list.length - wanted.length; i++) {
    let ok = true;
    for (let j = 0; j < wanted.length; j++) {
      if (list[i + j] !== wanted[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function routeLabGoalSideOvershootCount(path, startPos, endPos) {
  const list = Array.isArray(path) ? path : [];
  const fretDir = endPos?.fret === startPos?.fret ? 0 : (endPos?.fret > startPos?.fret ? 1 : -1);
  if (!list.length || fretDir === 0) return 0;
  let count = 0;
  for (let i = 1; i < list.length - 1; i++) {
    const fret = list[i]?.fret;
    if (!Number.isFinite(fret)) continue;
    if (fretDir > 0 && fret > endPos.fret) count += 1;
    if (fretDir < 0 && fret < endPos.fret) count += 1;
  }
  return count;
}

function evaluateRouteLabGenericQuality({ result, startPos, endPos, scaleName, scaleIntervals, maxPerString }) {
  const phrasing = inferRouteLabPreferredNotesPerString(scaleName, scaleIntervals, maxPerString);
  const maxRun = routeLabMaxRun(result.path);
  const reversals = routeLabFretReversalCount(result.path);
  const overshootCount = routeLabGoalSideOvershootCount(result.path, startPos, endPos);
  const hardFailures = [];
  const softFailures = [];

  if (result.reason) hardFailures.push(result.reason);

  if (!result.reason && maxRun > phrasing.hardLimit) {
    hardFailures.push(`Bloque máximo ${maxRun} > ${phrasing.hardLimit}`);
  } else if (!result.reason && maxRun > phrasing.softTarget) {
    softFailures.push(`Bloque máximo ${maxRun} > ${phrasing.softTarget}`);
  }

  if (!result.reason && reversals > 2) softFailures.push(`Retrocesos ${reversals} > 2`);
  else if (!result.reason && reversals > 1) softFailures.push(`Retrocesos ${reversals} > 1`);

  if (!result.reason && overshootCount > 1) softFailures.push(`Se pasa del objetivo ${overshootCount} veces`);
  else if (!result.reason && overshootCount > 0) softFailures.push(`Se pasa del objetivo ${overshootCount} vez`);

  return {
    maxRun,
    reversals,
    overshootCount,
    hardFailures,
    softFailures,
    metrics: {
      noRoute: !!result.reason,
      runHard: !result.reason && maxRun > phrasing.hardLimit,
      reversalHard: false,
      runWarn: !result.reason && maxRun > phrasing.softTarget && maxRun <= phrasing.hardLimit,
      reversalWarn: !result.reason && reversals > 1,
      overshootWarn: !result.reason && overshootCount > 0,
    },
  };
}

function evaluateRouteLabFixedTest(test, tuning = ROUTE_LAB_DEFAULT_TUNING) {
  const intervals = buildScaleIntervals(test.scaleName, "", test.rootPc);
  const startPos = parsePosCode(test.startCode);
  const endPos = parsePosCode(test.endCode);
  const result = computeRouteLab({
    rootPc: test.rootPc,
    scaleName: test.scaleName,
    scaleIntervals: intervals,
    maxFret: test.maxFret,
    startPos,
    endPos,
    maxNotesPerString: test.maxPerString,
    tuning,
  });

  const codes = routeLabCodesFromPath(result.path);
  const generic = evaluateRouteLabGenericQuality({
    result,
    startPos,
    endPos,
    scaleName: test.scaleName,
    scaleIntervals: intervals,
    maxPerString: test.maxPerString,
  });

  const hardFailures = [...generic.hardFailures];
  const softFailures = [...generic.softFailures];

  const pushFailure = (severity, text) => {
    if (severity === "soft") softFailures.push(text);
    else hardFailures.push(text);
  };

  for (const check of test.checks || []) {
    const severity = check.severity || "hard";
    if (check.type === "includeSeq" && !routeLabHasAdjacentSequence(codes, check.seq)) {
      pushFailure(severity, `Falta ${check.seq.join(" \u2192 ")}`);
    }
    if (check.type === "excludeSeq" && routeLabHasAdjacentSequence(codes, check.seq)) {
      pushFailure(severity, `Sobra ${check.seq.join(" \u2192 ")}`);
    }
    if (check.type === "excludeCode" && codes.includes(check.code)) {
      pushFailure(severity, `Incluye ${check.code}`);
    }
  }

  return {
    ...test,
    result,
    codes,
    text: codes.join(" \u2192 "),
    maxRun: generic.maxRun,
    reversals: generic.reversals,
    overshootCount: generic.overshootCount,
    ok: hardFailures.length === 0,
    warning: hardFailures.length === 0 && softFailures.length > 0,
    failures: [...hardFailures, ...softFailures],
    hardFailures,
    softFailures,
    metrics: generic.metrics,
  };
}

function runRouteLabFixedTests(tuning = ROUTE_LAB_DEFAULT_TUNING) {
  return ROUTE_LAB_FIXED_TESTS.map((test) => evaluateRouteLabFixedTest(test, tuning));
}

function summarizeRouteLabFixedResults(results) {
  const total = results.length;
  const passed = results.filter((x) => x.ok && !x.warning).length;
  const warning = results.filter((x) => x.warning).length;
  const failed = results.filter((x) => !x.ok).length;
  return { total, passed, warning, failed };
}

function buildRouteLabScalePositions({ rootPc, scaleName, maxFret }) {
  const intervals = buildScaleIntervals(scaleName, "", rootPc);
  const scalePcSet = new Set(intervals.map((i) => mod12(rootPc + i)));
  const positions = [];
  for (let sIdx = 0; sIdx < 6; sIdx++) {
    for (let fret = 0; fret <= Math.min(maxFret, 12); fret++) {
      const pc = mod12(STRINGS[sIdx].pc + fret);
      if (!scalePcSet.has(pc)) continue;
      positions.push({
        sIdx,
        fret,
        pc,
        pitch: pitchAt(sIdx, fret),
        code: `${sIdx + 1}${fret}`,
      });
    }
  }
  positions.sort((a, b) => a.pitch - b.pitch || a.sIdx - b.sIdx || a.fret - b.fret);
  return { intervals, positions };
}

function buildRouteLabBenchmarkCases() {
  const out = [];

  for (const spec of ROUTE_LAB_BENCHMARK_SPECS) {
    const { positions } = buildRouteLabScalePositions(spec);
    if (positions.length < 8) continue;

    const lowCutPitch = positions[Math.max(0, Math.floor((positions.length - 1) * 0.35))]?.pitch ?? positions[positions.length - 1].pitch;
    const highCutPitch = positions[Math.max(0, Math.floor((positions.length - 1) * 0.65))]?.pitch ?? positions[0].pitch;
    const lowPool = positions.filter((p) => p.pitch <= lowCutPitch);
    const highPool = positions.filter((p) => p.pitch >= highCutPitch);
    const asc = [];
    const seen = new Set();

    for (let i = 0; i < lowPool.length && asc.length < (spec.targetAsc || 12); i += 2) {
      const start = lowPool[i];
      for (let j = 0; j < highPool.length && asc.length < (spec.targetAsc || 12); j += 2) {
        const end = highPool[j];
        const pitchGap = end.pitch - start.pitch;
        const stringGap = Math.abs(end.sIdx - start.sIdx);
        if (pitchGap < 7 || pitchGap > 19) continue;
        if (stringGap < 2) continue;
        if (start.code === end.code) continue;

        const key = `${spec.scaleName}|${start.code}|${end.code}`;
        if (seen.has(key)) continue;
        seen.add(key);
        asc.push({
          id: key,
          label: `${spec.scaleName} · ${start.code} \u2192 ${end.code}`,
          rootPc: spec.rootPc,
          scaleName: spec.scaleName,
          startCode: start.code,
          endCode: end.code,
          maxFret: spec.maxFret,
          maxPerString: spec.maxPerString,
        });
      }
    }

    const desc = asc.map((item) => ({
      ...item,
      id: `${item.id}|desc`,
      label: `${item.scaleName} · ${item.endCode} \u2192 ${item.startCode}`,
      startCode: item.endCode,
      endCode: item.startCode,
    }));

    out.push(...asc, ...desc);
  }

  return out;
}

function evaluateRouteLabBenchmarkCase(test, tuning = ROUTE_LAB_DEFAULT_TUNING) {
  const intervals = buildScaleIntervals(test.scaleName, "", test.rootPc);
  const startPos = parsePosCode(test.startCode);
  const endPos = parsePosCode(test.endCode);
  const result = computeRouteLab({
    rootPc: test.rootPc,
    scaleName: test.scaleName,
    scaleIntervals: intervals,
    maxFret: test.maxFret,
    startPos,
    endPos,
    maxNotesPerString: test.maxPerString,
    tuning,
  });
  const generic = evaluateRouteLabGenericQuality({
    result,
    startPos,
    endPos,
    scaleName: test.scaleName,
    scaleIntervals: intervals,
    maxPerString: test.maxPerString,
  });

  return {
    ...test,
    result,
    text: routeLabCodesFromPath(result.path).join(" \u2192 "),
    maxRun: generic.maxRun,
    reversals: generic.reversals,
    overshootCount: generic.overshootCount,
    ok: generic.hardFailures.length === 0,
    warning: generic.hardFailures.length === 0 && generic.softFailures.length > 0,
    hardFailures: generic.hardFailures,
    softFailures: generic.softFailures,
    metrics: generic.metrics,
  };
}

function summarizeRouteLabBenchmark(cases, tuning = ROUTE_LAB_DEFAULT_TUNING) {
  const results = cases.map((test) => evaluateRouteLabBenchmarkCase(test, tuning));
  const byScaleMap = new Map();

  for (const item of results) {
    if (!byScaleMap.has(item.scaleName)) {
      byScaleMap.set(item.scaleName, { scaleName: item.scaleName, total: 0, passed: 0, warning: 0, failed: 0 });
    }
    const row = byScaleMap.get(item.scaleName);
    row.total += 1;
    if (!item.ok) row.failed += 1;
    else if (item.warning) row.warning += 1;
    else row.passed += 1;
  }

  const total = results.length;
  const passed = results.filter((x) => x.ok && !x.warning).length;
  const warning = results.filter((x) => x.warning).length;
  const failed = results.filter((x) => !x.ok).length;
  const noRoute = results.filter((x) => x.metrics.noRoute).length;
  const overshootWarnings = results.filter((x) => x.metrics.overshootWarn).length;
  const runWarnings = results.filter((x) => x.metrics.runWarn || x.metrics.runHard).length;
  const reversalWarnings = results.filter((x) => x.metrics.reversalWarn || x.metrics.reversalHard).length;

  return {
    total,
    passed,
    warning,
    failed,
    noRoute,
    overshootWarnings,
    runWarnings,
    reversalWarnings,
    byScale: Array.from(byScaleMap.values()),
    results,
  };
}

function buildRouteLabPitchLine({ rootPc, scaleIntervals, startPitch, endPitch }) {
  const ordered = Array.from(new Set((scaleIntervals || []).map(mod12))).sort((a, b) => a - b);
  if (ordered.length < 2) return { pitches: [], pitchDirection: 0, error: "Escala demasiado corta" };
  if (startPitch === endPitch) return { pitches: [startPitch], pitchDirection: 0, error: null };

  const startRel = mod12(startPitch - rootPc);
  const endRel = mod12(endPitch - rootPc);
  const startIdx = ordered.indexOf(startRel);
  const endIdx = ordered.indexOf(endRel);
  if (startIdx < 0 || endIdx < 0) {
    return { pitches: [], pitchDirection: 0, error: "Inicio y/o fin no están en la escala" };
  }

  const pitchDirection = endPitch > startPitch ? 1 : -1;
  const pitches = [startPitch];
  let currentPitch = startPitch;
  let currentIdx = startIdx;
  let guard = 0;

  while ((pitchDirection === 1 && currentPitch < endPitch) || (pitchDirection === -1 && currentPitch > endPitch)) {
    const nextIdx = pitchDirection === 1
      ? (currentIdx + 1) % ordered.length
      : (currentIdx - 1 + ordered.length) % ordered.length;

    const curRel = ordered[currentIdx];
    const nextRel = ordered[nextIdx];
    let step = pitchDirection === 1
      ? ((nextRel - curRel + 12) % 12)
      : ((curRel - nextRel + 12) % 12);
    if (step === 0) step = 12;

    currentPitch += pitchDirection * step;
    pitches.push(currentPitch);
    currentIdx = nextIdx;

    guard += 1;
    if (guard > 400) return { pitches: [], pitchDirection, error: "Ruta demasiado larga" };
  }

  if (currentPitch !== endPitch) {
    return { pitches: [], pitchDirection, error: "No se puede llegar siguiendo la escala" };
  }

  return { pitches, pitchDirection, error: null };
}

function computeRouteLab({
  rootPc,
  scaleName,
  scaleIntervals,
  maxFret,
  startPos,
  endPos,
  maxNotesPerString,
}) {
  if (!startPos || !endPos) return { path: [], cost: null, reason: "Posición inválida", debugSteps: [] };
  if (startPos.fret > maxFret || endPos.fret > maxFret) return { path: [], cost: null, reason: "Aumenta trastes", debugSteps: [] };

  const startPitch = pitchAt(startPos.sIdx, startPos.fret);
  const endPitch = pitchAt(endPos.sIdx, endPos.fret);
  const pitchLine = buildRouteLabPitchLine({ rootPc, scaleIntervals, startPitch, endPitch });
  if (pitchLine.error) return { path: [], cost: null, reason: pitchLine.error, debugSteps: [] };

  const normalizedScale = normalizeScaleName(scaleName || "");
  const family = routeLabTemplateFamily(normalizedScale, scaleIntervals);
  const width = family === "penta" || family === "major_minor" ? 5 : 6;
  const phrasing = inferRouteLabPreferredNotesPerString(scaleName, scaleIntervals, maxNotesPerString);
  const targetStringDir = endPos.sIdx === startPos.sIdx ? 0 : (endPos.sIdx > startPos.sIdx ? 1 : -1);
  const targetFretDir = endPos.fret === startPos.fret ? 0 : (endPos.fret > startPos.fret ? 1 : -1);
  const maxStringJump = family === "bebop" ? 2 : 1;
  const maxFretJump = family === "bebop" ? 6 : 5;

  const boxStartsForFret = (fret) => {
    const maxStart = Math.max(0, maxFret - (width - 1));
    const lo = Math.max(0, fret - (width - 1));
    const hi = Math.min(fret, maxStart);
    const out = [];
    for (let start = lo; start <= hi; start++) out.push(start);
    return out.length ? out : [Math.max(0, Math.min(maxStart, fret))];
  };

  const corridorStarts = Array.from(new Set([
    ...boxStartsForFret(startPos.fret),
    ...boxStartsForFret(endPos.fret),
    ...boxStartsForFret(Math.floor((startPos.fret + endPos.fret) / 2)),
  ])).sort((a, b) => a - b);

  const corridorDeviation = (fret) => {
    if (!corridorStarts.length) return 0;
    let best = Number.POSITIVE_INFINITY;
    for (const start of corridorStarts) {
      const end = start + width - 1;
      if (fret >= start && fret <= end) return 0;
      const dev = fret < start ? (start - fret) : (fret - end);
      if (dev < best) best = dev;
    }
    return Number.isFinite(best) ? best : 0;
  };

  const scalePcSet = new Set(scaleIntervals.map((i) => mod12(rootPc + i)));
  const boxCache = new Map();
  const getBoxInfo = (start) => {
    if (boxCache.has(start)) return boxCache.get(start);
    const end = Math.min(maxFret, start + width - 1);
    const stringFrets = Array.from({ length: 6 }, () => []);
    for (let sIdx = 0; sIdx < 6; sIdx++) {
      for (let fret = start; fret <= end; fret++) {
        const pc = mod12(STRINGS[sIdx].pc + fret);
        if (scalePcSet.has(pc)) stringFrets[sIdx].push(fret);
      }
    }
    const info = { start, end, stringFrets };
    boxCache.set(start, info);
    return info;
  };

  const cellInBox = (boxStart, pos) => {
    if (!pos) return false;
    return getBoxInfo(boxStart).stringFrets[pos.sIdx].includes(pos.fret);
  };

  const candidates = pitchLine.pitches.map((pitch, idx) => {
    if (idx === 0) return [{ sIdx: startPos.sIdx, fret: startPos.fret, pc: mod12(STRINGS[startPos.sIdx].pc + startPos.fret) }];
    if (idx === pitchLine.pitches.length - 1) return [{ sIdx: endPos.sIdx, fret: endPos.fret, pc: mod12(STRINGS[endPos.sIdx].pc + endPos.fret) }];
    return positionsForPitch(pitch, maxFret);
  });

  if (candidates.some((arr) => !arr.length)) {
    return { path: [], cost: null, reason: "Hay notas de la línea sin posición en este rango", debugSteps: [] };
  }

  const futureCoverage = (boxStart, fromIndex, lookahead = 4) => {
    let hits = 0;
    for (let i = fromIndex; i < Math.min(candidates.length, fromIndex + lookahead); i++) {
      if (candidates[i].some((cand) => cellInBox(boxStart, cand))) hits += 1;
    }
    return hits;
  };

  const nextSameStringOptions = (boxStart, fromIndex, sIdx) => {
    if (fromIndex >= candidates.length) return [];
    return candidates[fromIndex].filter((cand) => cand.sIdx === sIdx && cellInBox(boxStart, cand));
  };

  const sameStringChainPotential = (boxStart, fromIndex, sIdx) => {
    let len = 0;
    for (let j = fromIndex; j < candidates.length; j++) {
      const ok = candidates[j].some((cand) => cand.sIdx === sIdx && cellInBox(boxStart, cand));
      if (!ok) break;
      len += 1;
    }
    return len;
  };

  const movementCost = (a, b) => {
    const ds = Math.abs(a.sIdx - b.sIdx);
    const df = Math.abs(a.fret - b.fret);
    const farStringPenalty = ds > 1 ? (ds - 1) * 7 : 0;
    const farFretPenalty = df > 4 ? (df - 4) * 2.4 : 0;
    const sameStringBonus = ds === 0 ? (df <= 1 ? 0.8 : df === 2 ? 0.35 : 0) : 0;
    return Math.max(0.05, df + 1.25 * ds + farStringPenalty + farFretPenalty - sameStringBonus);
  };

  const compareCost = (a, b) => {
    if (!b) return -1;
    if (a.primary !== b.primary) return a.primary - b.primary;
    return a.smooth - b.smooth;
  };

  const addCost = (a, primary, smooth) => ({
    primary: a.primary + primary,
    smooth: a.smooth + smooth,
  });

  const costToNumber = (cost) => Number((cost.primary * 10 + cost.smooth).toFixed(2));

  const encodeKey = (i, sIdx, fret, runCount, fretTrend, boxStart) => `${i}|${sIdx}|${fret}|${runCount}|${fretTrend}|${boxStart}`;
  const decodeKey = (key) => {
    const [i, sIdx, fret, runCount, fretTrend, boxStart] = String(key).split("|").map((x) => parseInt(x, 10));
    return { i, sIdx, fret, runCount, fretTrend, boxStart };
  };

  const parent = new Map();
  const posByKey = new Map();
  const edgeMeta = new Map();
  let prev = new Map();

  for (const boxStart of boxStartsForFret(startPos.fret)) {
    const startKey = encodeKey(0, startPos.sIdx, startPos.fret, 1, 0, boxStart);
    const startCost = {
      primary: 0,
      smooth: (Math.abs(startPos.fret - (boxStart + ((width - 1) / 2))) * 0.08) - (futureCoverage(boxStart, 1, 4) * 0.35) - (nextSameStringOptions(boxStart, 1, startPos.sIdx).length * 4),
    };
    prev.set(startKey, startCost);
    parent.set(startKey, null);
    posByKey.set(startKey, candidates[0][0]);
  }

  for (let i = 1; i < candidates.length; i++) {
    const cur = new Map();

    for (const [prevKey, prevCost] of prev.entries()) {
      const prevInfo = decodeKey(prevKey);
      const prevPos = posByKey.get(prevKey);
      const remainingStepsAfter = candidates.length - 1 - i;
      const currentBoxSameString = candidates[i].filter((cand) => cand.sIdx === prevInfo.sIdx && cellInBox(prevInfo.boxStart, cand));
      const currentBoxAny = candidates[i].filter((cand) => cellInBox(prevInfo.boxStart, cand));
      const oldFutureCoverage = futureCoverage(prevInfo.boxStart, i, 4);
      const currentBoxStringCount = getBoxInfo(prevInfo.boxStart).stringFrets[prevInfo.sIdx]?.length || 1;
      const currentStringTarget = Math.min(phrasing.hardLimit, Math.max(phrasing.phraseTarget, currentBoxStringCount));

      const feasible = [];
      for (const cand of candidates[i]) {
        const dsSigned = cand.sIdx - prevInfo.sIdx;
        const ds = Math.abs(dsSigned);
        const dfSigned = cand.fret - prevInfo.fret;
        const df = Math.abs(dfSigned);
        if (ds > maxStringJump) continue;
        if (df > maxFretJump) continue;
        if (Math.abs(endPos.sIdx - cand.sIdx) > remainingStepsAfter) continue;
        feasible.push({ cand, dsSigned, ds, dfSigned, df });
      }

      if (!feasible.length) continue;

      const sameStringForward = feasible
        .filter((item) => item.ds === 0 && item.df <= 3 && (targetFretDir === 0 || item.dfSigned === 0 || Math.sign(item.dfSigned) === targetFretDir))
        .sort((a, b) => (a.df - b.df) || (corridorDeviation(a.cand.fret) - corridorDeviation(b.cand.fret)) || (Math.abs(endPos.fret - a.cand.fret) - Math.abs(endPos.fret - b.cand.fret)));
      const bestSameStringForward = sameStringForward[0] || null;

      for (const item of feasible) {
        const { cand, dsSigned, ds, dfSigned, df } = item;
        const sameString = ds === 0;
        const nextRun = sameString ? prevInfo.runCount + 1 : 1;
        if (nextRun > phrasing.hardLimit) continue;

        const stepTrend = dfSigned === 0 ? 0 : (dfSigned > 0 ? 1 : -1);
        const nextTrend = stepTrend === 0 ? prevInfo.fretTrend : stepTrend;
        const overshoot = targetFretDir > 0
          ? Math.max(0, cand.fret - endPos.fret)
          : targetFretDir < 0
            ? Math.max(0, endPos.fret - cand.fret)
            : 0;

        let boxStarts = boxStartsForFret(cand.fret).filter((boxStart) => cellInBox(boxStart, cand));
        if (!boxStarts.length) boxStarts = boxStartsForFret(cand.fret);

        const rankedBoxes = boxStarts
          .map((boxStart) => ({
            boxStart,
            futureSameCount: nextSameStringOptions(boxStart, i + 1, cand.sIdx).length,
            futureCoverage: futureCoverage(boxStart, i + 1, 4),
          }))
          .sort((a, b) => (b.futureSameCount - a.futureSameCount) || (b.futureCoverage - a.futureCoverage) || (Math.abs(a.boxStart - prevInfo.boxStart) - Math.abs(b.boxStart - prevInfo.boxStart)));

        const bestFutureSameCount = rankedBoxes.length ? rankedBoxes[0].futureSameCount : 0;
        const bestFutureCoverage = rankedBoxes.length ? rankedBoxes[0].futureCoverage : 0;

        for (const boxInfo of rankedBoxes) {
          const { boxStart, futureSameCount, futureCoverage: nextBoxCoverage } = boxInfo;
          const sameBox = boxStart === prevInfo.boxStart;
          const center = boxStart + ((width - 1) / 2);
          const nextBoxStringCount = getBoxInfo(boxStart).stringFrets[cand.sIdx]?.length || 1;
          const nextStringTarget = Math.min(phrasing.hardLimit, Math.max(phrasing.phraseTarget, nextBoxStringCount));
          let primary = 0;
          let smooth = 0;

          smooth += movementCost(prevPos, cand);

          if (bestSameStringForward && !sameString && prevInfo.runCount < currentStringTarget) {
            primary += 42;
          }

          if (bestSameStringForward && sameString && cand.sIdx === bestSameStringForward.cand.sIdx && cand.fret === bestSameStringForward.cand.fret) {
            smooth -= 4.5;
          }

          if (!sameString && currentBoxSameString.length && prevInfo.runCount < currentStringTarget) {
            primary += 24;
          }

          if (!sameBox && currentBoxAny.length) {
            primary += oldFutureCoverage >= 2 ? 28 : 18;
          }

          if (futureSameCount > 0) {
            smooth -= 1.4 * futureSameCount;
          } else if (bestFutureSameCount > 0) {
            primary += 8;
          }

          if (!sameBox) {
            const boxShift = Math.abs(boxStart - prevInfo.boxStart);
            if (boxShift > 3) continue;
            primary += 4 + (boxShift * 0.9);
            if (oldFutureCoverage >= 2) primary += 4;
          } else {
            smooth -= 0.8;
          }

          if (prevInfo.fretTrend !== 0 && stepTrend !== 0 && stepTrend !== prevInfo.fretTrend) {
            if (!(ds === 1 && df <= 2)) primary += 5;
          }

          if (targetFretDir !== 0 && stepTrend !== 0 && stepTrend !== targetFretDir) {
            if (!(ds === 1 && df <= 2)) primary += 4.2;
          }

          if (targetStringDir !== 0 && dsSigned !== 0 && Math.sign(dsSigned) !== targetStringDir) {
            primary += 0.8;
          }

          if (nextRun > nextStringTarget) {
            primary += (nextRun - nextStringTarget) * (family === "penta" ? 18 : 7);
          } else if (sameString && nextRun <= nextStringTarget) {
            smooth -= 1.2;
          }

          if (sameString && stepTrend !== 0 && targetFretDir !== 0 && stepTrend === targetFretDir) {
            smooth -= 1.8;
          }

          if (ds === 1 && df <= 2) smooth -= 0.9;

          smooth += corridorDeviation(cand.fret) * 0.6;
          smooth += Math.abs(cand.fret - center) * 0.08;
          smooth -= nextBoxCoverage * 1.25;
          smooth -= bestFutureCoverage * 0.15;

          if (overshoot > 0) {
            const hasNonOvershootingAlternative = feasible.some((x) => {
              if (targetFretDir > 0) return x.cand.fret <= endPos.fret;
              if (targetFretDir < 0) return x.cand.fret >= endPos.fret;
              return true;
            });
            primary += overshoot * (remainingStepsAfter <= 2 ? 8 : 3.2);
            if (hasNonOvershootingAlternative) primary += 10;
          }

          const sameStringPotential = sameStringChainPotential(boxStart, i, cand.sIdx);
          if (sameStringPotential > nextStringTarget) {
            primary += (sameStringPotential - nextStringTarget) * (family === "penta" ? 16 : 6);
          }

          if (remainingStepsAfter <= 2 && futureSameCount > 0 && !sameString) {
            primary += 7;
          }

          const totalCost = addCost(prevCost, primary, smooth);
          const nextKey = encodeKey(i, cand.sIdx, cand.fret, nextRun, nextTrend, boxStart);

          if (!cur.has(nextKey) || compareCost(totalCost, cur.get(nextKey)) < 0) {
            cur.set(nextKey, totalCost);
            parent.set(nextKey, prevKey);
            posByKey.set(nextKey, cand);
            edgeMeta.set(nextKey, {
              from: `${prevPos.sIdx + 1}${prevPos.fret}`,
              to: `${cand.sIdx + 1}${cand.fret}`,
              sameString,
              ds,
              df,
              runCount: nextRun,
              corridorDev: Number(corridorDeviation(cand.fret).toFixed(2)),
              targetSideOvershoot: Number(overshoot.toFixed(2)),
              hadSameStringForward: !!bestSameStringForward,
              bestSameStringForwardFret: bestSameStringForward ? bestSameStringForward.cand.fret : null,
              hadNonOvershootingAlternative: overshoot > 0 && feasible.some((x) => {
                if (targetFretDir > 0) return x.cand.fret <= endPos.fret;
                if (targetFretDir < 0) return x.cand.fret >= endPos.fret;
                return true;
              }),
              stepCost: Number((primary * 10 + smooth).toFixed(2)),
              totalCost: costToNumber(totalCost),
              templateText: `caja=${boxStart}-${boxStart + width - 1} · caja activa=${sameBox ? "sí" : "no"} · continuidad=${futureSameCount} · cobertura=${nextBoxCoverage}`,
            });
          }
        }
      }
    }

    if (!cur.size) return { path: [], cost: null, reason: "No encontré ruta con estas reglas", debugSteps: [] };
    prev = cur;
  }

  let bestKey = null;
  let bestCost = null;
  for (const [key, cost] of prev.entries()) {
    const info = decodeKey(key);
    if (info.sIdx !== endPos.sIdx || info.fret !== endPos.fret) continue;
    if (!bestCost || compareCost(cost, bestCost) < 0) {
      bestCost = cost;
      bestKey = key;
    }
  }

  if (!bestKey) return { path: [], cost: null, reason: "No pude terminar exactamente en el destino", debugSteps: [] };

  const path = [];
  const debugSteps = [];
  let walk = bestKey;
  while (walk) {
    path.push(posByKey.get(walk));
    if (edgeMeta.has(walk)) debugSteps.push(edgeMeta.get(walk));
    walk = parent.get(walk);
  }

  path.reverse();
  debugSteps.reverse();

  return {
    path,
    debugSteps,
    cost: costToNumber(bestCost),
    reason: null,
  };
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
  strictFretDirection = false,
  forcedFretTrend = 0,
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

  // Estado: i|sIdx|fret|consec|instIdx|posStart|fretTrend
  // fretTrend: 0 = aún sin dirección fijada, 1 = subiendo trastes, -1 = bajando trastes.
  // Aquí la dirección se mide contra la nota anterior, no contra el inicio del bloque,
  // para que un salto 7 -> 3 cuente como retroceso real.
  function key(i, sIdx, fret, consec, instIdx, posStart, fretTrend) {
    return `${i}|${sIdx}|${fret}|${consec}|${instIdx}|${posStart}|${fretTrend}`;
  }

  function parseKey(k) {
    const [i, s, f, c, inst, ps, trend] = k.split("|").map((x) => parseInt(x, 10));
    return { i, sIdx: s, fret: f, consec: c, instIdx: inst, posStart: ps, fretTrend: trend };
  }

  function stepFeasible(prevPos, candPos) {
    const df = Math.abs(candPos.fret - prevPos.fret);
    const ds = Math.abs(candPos.sIdx - prevPos.sIdx);
    if (df > maxFretJumpPerStep || ds > maxStringJumpPerStep) return false;
    return true;
  }

  function nextFretTrend(prevTrend, prevPos, candPos) {
    if (forcedFretTrend === 1 || forcedFretTrend === -1) return forcedFretTrend;
    const signedDf = candPos.fret - prevPos.fret;
    if (signedDf === 0) return prevTrend;
    const stepTrend = signedDf > 0 ? 1 : -1;
    return prevTrend === 0 ? stepTrend : prevTrend;
  }

  function strictTrendFeasible(prevTrend, prevPos, candPos) {
    if (!strictFretDirection) return true;
    const signedDf = candPos.fret - prevPos.fret;
    if (signedDf === 0) return true;
    const stepTrend = signedDf > 0 ? 1 : -1;
    const targetTrend = (forcedFretTrend === 1 || forcedFretTrend === -1) ? forcedFretTrend : prevTrend;
    return targetTrend === 0 || stepTrend === targetTrend;
  }

  function trendReversalPenalty(prevTrend, prevPos, candPos) {
    if (strictFretDirection) return 0;
    const signedDf = candPos.fret - prevPos.fret;
    if (signedDf === 0) return 0;
    const stepTrend = signedDf > 0 ? 1 : -1;
    if (prevTrend === 0 || stepTrend === prevTrend) return 0;
    return 12 + 2.5 * Math.abs(signedDf);
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
      const k = key(0, startPos.sIdx, startPos.fret, 1, instIdx, ps, 0);
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
          if (!strictTrendFeasible(prevInfo.fretTrend, prevPos, cand)) continue;

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
        if (!strictTrendFeasible(prevInfo.fretTrend, prevPos, cand)) continue;

        const cellKey = `${cand.sIdx}:${cand.fret}`;
        const instsAll = allowedInstancesForCell(cellKey);
        if (routeMode !== "free" && instsAll.length === 0) continue;

        const insts = mustStayInst ? instsAll.filter((x) => x === prevInfo.instIdx) : instsAll;
        if (mustStayInst && insts.length === 0) continue;

        const baseMove = movementCost(prevPos, cand);
        // Si quieres ruta "vertical" (cambiar cuerda) no penalizamos cambios de cuerda por NPS.
        const npsPenalty = preferNps && !preferVertical && !sameString && prevInfo.consec < npsTarget ? 2.2 : 0;
        const reversalPenalty = trendReversalPenalty(prevInfo.fretTrend, prevPos, cand);

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

            const nk = key(
              i,
              cand.sIdx,
              cand.fret,
              newConsec,
              instIdx,
              psNew,
              nextFretTrend(prevInfo.fretTrend, prevPos, cand)
            );
            const cost = pcost + baseMove + npsPenalty + reversalPenalty + switchPenalty + posCost + verticalPenalty - verticalBonus;

            if (!cur.has(nk) || cost < cur.get(nk)) {
              cur.set(nk, cost);
              parent.set(nk, pk);
              posByKey.set(nk, cand);
            }
          }
        }
      }
    }

    if (!cur.size) {
      return {
        path: [],
        cost: null,
        reason: strictFretDirection
          ? "No encontré ruta estricta con estos límites"
          : "No encontré ruta con estos límites/patrones",
      };
    }
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

const STAFF_LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

function midiToSpelledPitch(midi, preferSharps) {
  const pc = mod12(midi);
  const name = pcToName(pc, preferSharps);
  const letter = name[0] || "C";
  const accidentalRaw = name.slice(1);
  const accidental = accidentalRaw === "#" ? "\u266F" : accidentalRaw === "b" ? "\u266D" : accidentalRaw;
  const octave = Math.floor(midi / 12) - 1;
  return { midi, name, letter, accidental, octave };
}

function staffStepFromPitch(spelled, clef) {
  const baseOctave = clef === "bass" ? 2 : 4;
  const baseLetter = clef === "bass" ? "G" : "E";
  const diatonic = (spelled.octave * 7) + STAFF_LETTER_INDEX[spelled.letter];
  const base = (baseOctave * 7) + STAFF_LETTER_INDEX[baseLetter];
  return diatonic - base;
}

function staffYFromStep(step, top, lineGap) {
  return top + (lineGap * 4) - (step * (lineGap / 2));
}

function ledgerLineSteps(step) {
  const out = [];
  if (step < 0) {
    for (let s = 0; s >= step; s -= 2) out.push(s);
  } else if (step > 8) {
    for (let s = 8; s <= step; s += 2) out.push(s);
  }
  return out.filter((s) => s < 0 || s > 8);
}

function resolveStaffSpec(events, clefMode) {
  if (clefMode === "treble") return { clef: "treble", transpose: 0 };
  if (clefMode === "bass") return { clef: "bass", transpose: 0 };
  if (clefMode === "guitar") return { clef: "treble", transpose: 12 };

  const midis = (events || []).flatMap((evt) => Array.isArray(evt?.notes) ? evt.notes : []);
  const avg = midis.length ? midis.reduce((a, b) => a + b, 0) / midis.length : 60;
  return avg < 54 ? { clef: "bass", transpose: 0 } : { clef: "treble", transpose: 0 };
}

const TREBLE_KEY_SIGNATURE_STEPS = {
  sharp: [8, 5, 9, 6, 3, 7, 4],
  flat: [4, 7, 3, 6, 2, 5, 8],
};

const BASS_KEY_SIGNATURE_STEPS = {
  sharp: [6, 3, 7, 4, 1, 5, 2],
  flat: [2, 5, 1, 4, 0, 3, 6],
};

function keySignatureStepsForClef(clef, type) {
  return clef === "bass" ? BASS_KEY_SIGNATURE_STEPS[type] || [] : TREBLE_KEY_SIGNATURE_STEPS[type] || [];
}

const KEY_SIGNATURE_LETTER_ORDER = {
  sharp: ["F", "C", "G", "D", "A", "E", "B"],
  flat: ["B", "E", "A", "D", "G", "C", "F"],
};

function keySignatureLetterAccidentals(keySignature) {
  const type = keySignature?.type || null;
  const count = Math.max(0, Math.min(7, Number(keySignature?.count) || 0));
  const map = new Map();
  if (!type || !count) return map;

  const letters = KEY_SIGNATURE_LETTER_ORDER[type] || [];
  const accidental = type === "sharp" ? "\u266F" : "\u266D";
  letters.slice(0, count).forEach((letter) => map.set(letter, accidental));
  return map;
}

function displayedAccidentalForNote(note, signatureMap) {
  const keyAccidental = signatureMap?.get(note.letter) || "";
  const noteAccidental = note.accidental || "";
  if (noteAccidental === keyAccidental) return "";
  if (!noteAccidental && keyAccidental) return "\u266E";
  return noteAccidental;
}

function formatChordBadgeDegree(label) {
  const s = String(label || "");
  if (!s) return "";
  if (s === "1") return "1";
  if (s === "b3") return "m3";
  return s;
}

function chordBadgeRoleFromDegreeLabel(label, interval) {
  const s = String(label || "").toLowerCase();
  const intv = mod12(interval ?? 0);
  if (intv === 0 || s === "1") return "root";
  if (s === "3" || s === "b3" || s === "#3") return "third";
  if (s === "5" || s === "b5" || s === "#5") return "fifth";
  if (s === "6") return "sixth";
  if (s.includes("7")) return "seventh";
  if (s.includes("13")) return "thirteenth";
  if (s === "4" || s.includes("11")) return "eleventh";
  if (s === "2" || s.includes("9")) return "ninth";
  return "other";
}

function buildChordBadgeItems({ notes, intervals, degreeLabels, ext6 = false, ext9 = false, ext11 = false, ext13 = false, structure = "triad" }) {
  const safeNotes = Array.isArray(notes) ? notes : [];
  const safeIntervals = Array.isArray(intervals) ? intervals : [];

  return safeNotes
    .map((note, idx) => {
      const rawInterval = safeIntervals[idx] ?? 0;
      const fallback = intervalToChordToken(rawInterval, {
        ext6,
        ext9: ext9 && structure !== "triad",
        ext11: ext11 && structure !== "triad",
        ext13: ext13 && structure !== "triad",
      });
      const degreeRaw = String(degreeLabels?.[idx] || fallback);
      const degree = formatChordBadgeDegree(degreeRaw);
      const role = chordBadgeRoleFromDegreeLabel(degreeRaw, rawInterval);
      return note && degree ? { note, degree, role } : null;
    })
    .filter(Boolean);
}

function ChordNoteBadgeStrip({ items, bassNote, bassLabel = "Bajo", colorMap }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length && !bassNote) return null;

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
      {safeItems.length ? (
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          {safeItems.map((item, idx) => {
            const bg = (colorMap && colorMap[item.role]) || (colorMap && colorMap.other) || "#0ea5e9";
            const fg = isDark(bg) ? "#ffffff" : "#0f172a";
            return (
              <div key={item.note + "-" + item.degree + "-" + idx} className="flex min-w-[34px] flex-col items-center gap-1">
                <div className="text-[11px] font-semibold text-slate-700">{item.note}</div>
                <div
                  className="min-w-[34px] rounded-md px-2 py-1 text-center text-[10px] font-semibold leading-none shadow-sm"
                  style={{ backgroundColor: bg, color: fg }}
                >
                  {item.degree}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {bassNote ? (
        <div className="flex min-w-[46px] flex-col items-center gap-1">
          <div className="text-[11px] font-semibold text-slate-700">{bassNote}</div>
          <div className="min-w-[46px] rounded-md bg-slate-700 px-2 py-1 text-center text-[10px] font-semibold leading-none text-white shadow-sm">
            {bassLabel}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MusicStaff({ events, preferSharps, clefMode = "guitar", beatsPerBar = 4, beatUnit = 4, keySignature = null }) {
  const safeEvents = Array.isArray(events) ? events.filter((evt) => Array.isArray(evt?.notes) && evt.notes.length) : [];
  if (!safeEvents.length) return null;

  const { clef, transpose } = resolveStaffSpec(safeEvents, clefMode);
  const lineGap = 12;
  const staffTop = 28;
  const signatureType = keySignature?.type || null;
  const signatureCount = Math.max(0, Math.min(7, Number(keySignature?.count) || 0));
  const signatureGlyph = signatureType === "sharp" ? "\u266F" : signatureType === "flat" ? "\u266D" : "";
  const signatureSteps = signatureType ? keySignatureStepsForClef(clef, signatureType).slice(0, signatureCount) : [];
  const signatureWidth = signatureSteps.length ? (signatureSteps.length * 11) + 8 : 0;
  const signatureMap = keySignatureLetterAccidentals(keySignature);
  const idealNoteSpacing = 38;
  const minNoteSpacing = 24;
  const targetInnerWidth = 880;
  const eventCount = Math.max(1, safeEvents.length);
  const noteSpacing = Math.max(minNoteSpacing, Math.min(idealNoteSpacing, targetInnerWidth / Math.max(eventCount, beatsPerBar)));
  const measureWidth = noteSpacing * beatsPerBar;
  const leftPad = 86 + signatureWidth;
  const rightPad = 24;
  const measures = Math.max(1, Math.ceil(safeEvents.length / beatsPerBar));
  const width = leftPad + (measures * measureWidth) + rightPad;
  const staffBottom = staffTop + (lineGap * 4);
  const clefGlyph = clef === "bass" ? "\uD834\uDD22" : "\uD834\uDD1E";

  const renderedEvents = safeEvents.map((evt, idx) => {
    const measureIdx = Math.floor(idx / beatsPerBar);
    const beatIdx = idx % beatsPerBar;
    const x = leftPad + (measureIdx * measureWidth) + 22 + (beatIdx * noteSpacing);
    const notes = evt.notes
      .map((midi) => midiToSpelledPitch(midi + transpose, preferSharps))
      .map((spelled) => {
        const step = staffStepFromPitch(spelled, clef);
        const displayAccidental = displayedAccidentalForNote(spelled, signatureMap);
        return { ...spelled, step, displayAccidental };
      })
      .sort((a, b) => a.step - b.step);
    const avgStep = notes.reduce((sum, note) => sum + note.step, 0) / notes.length;
    const stemDown = avgStep >= 4;
    return { x, notes, stemDown };
  });

  const verticalExtents = renderedEvents.flatMap((evt) => {
    if (!evt.notes.length) return [];
    const stemNote = evt.stemDown ? evt.notes[0] : evt.notes[evt.notes.length - 1];
    const stemY = staffYFromStep(stemNote.step, staffTop, lineGap);
    const stemEndY = evt.stemDown ? stemY + 30 : stemY - 30;

    return evt.notes.map((note) => {
      const y = staffYFromStep(note.step, staffTop, lineGap);
      const ledgerYs = ledgerLineSteps(note.step).map((step) => staffYFromStep(step, staffTop, lineGap));
      const ledgerTop = ledgerYs.length ? Math.min(...ledgerYs) - 2 : y - 7;
      const ledgerBottom = ledgerYs.length ? Math.max(...ledgerYs) + 2 : y + 7;
      const noteTop = y - 7;
      const noteBottom = y + 7;
      const accidentalTop = note.displayAccidental ? y - 10 : noteTop;
      const accidentalBottom = note.displayAccidental ? y + 6 : noteBottom;
      return {
        top: Math.min(noteTop, ledgerTop, accidentalTop, stemY, stemEndY),
        bottom: Math.max(noteBottom, ledgerBottom, accidentalBottom, stemY, stemEndY),
      };
    });
  });

  const contentTop = verticalExtents.length ? Math.min(staffTop - 12, ...verticalExtents.map((x) => x.top)) - 8 : staffTop - 20;
  const contentBottom = verticalExtents.length ? Math.max(staffBottom + 12, ...verticalExtents.map((x) => x.bottom)) + 8 : staffBottom + 20;
  const height = Math.max(132, contentBottom - contentTop);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white px-2 py-2">
      <svg
        width={width}
        height={height}
        viewBox={`0 ${contentTop} ${width} ${height}`}
        className="block"
        role="img"
        aria-label="Pentagrama en 4 por 4 con la ruta en negras"
      >
        {[0, 1, 2, 3, 4].map((line) => {
          const y = staffTop + (line * lineGap);
          return <line key={line} x1={16} y1={y} x2={width - 12} y2={y} stroke="#475569" strokeWidth="1" />;
        })}

        {Array.from({ length: measures - 1 }, (_, i) => {
          const x = leftPad + ((i + 1) * measureWidth);
          return <line key={i} x1={x} y1={staffTop - 1} x2={x} y2={staffBottom + 1} stroke="#475569" strokeWidth="1" />;
        })}

        <line x1={16} y1={staffTop - 1} x2={16} y2={staffBottom + 1} stroke="#475569" strokeWidth="1" />
        <line x1={width - 12} y1={staffTop - 1} x2={width - 12} y2={staffBottom + 1} stroke="#475569" strokeWidth="1.5" />

        <text x="30" y={clef === "bass" ? staffTop + 37 : staffTop + 42} fontSize={clef === "bass" ? "34" : "42"} fill="#0f172a">
          {clefGlyph}
        </text>

        {signatureSteps.map((step, idx) => {
          const x = 58 + (idx * 11);
          const y = staffYFromStep(step, staffTop, lineGap) + 4;
          return <text key={`${signatureType}-${idx}`} x={x} y={y} fontSize="18" fill="#0f172a">{signatureGlyph}</text>;
        })}

        <text x={62 + signatureWidth} y={staffTop + 16} fontSize="16" fontWeight="700" fill="#0f172a">{beatsPerBar}</text>
        <text x={62 + signatureWidth} y={staffTop + 38} fontSize="16" fontWeight="700" fill="#0f172a">{beatUnit}</text>

        {renderedEvents.map((evt, evtIdx) => (
          <g key={evtIdx}>
            {evt.notes.map((note, noteIdx) => {
              const y = staffYFromStep(note.step, staffTop, lineGap);
              const lines = ledgerLineSteps(note.step);
              return (
                <g key={noteIdx}>
                  {lines.map((step) => {
                    const ly = staffYFromStep(step, staffTop, lineGap);
                    return <line key={step} x1={evt.x - 10} y1={ly} x2={evt.x + 10} y2={ly} stroke="#475569" strokeWidth="1" />;
                  })}
                  {note.displayAccidental ? <text x={evt.x - 18} y={y + 4} fontSize="14" fill="#0f172a">{note.displayAccidental}</text> : null}
                  <ellipse cx={evt.x} cy={y} rx="6.8" ry="5.1" transform={`rotate(-20 ${evt.x} ${y})`} fill="#0f172a" />
                </g>
              );
            })}

            {evt.notes.length ? (() => {
              const stemNote = evt.stemDown ? evt.notes[0] : evt.notes[evt.notes.length - 1];
              const stemY = staffYFromStep(stemNote.step, staffTop, lineGap);
              const x = evt.stemDown ? evt.x - 6 : evt.x + 6;
              const y1 = stemY;
              const y2 = evt.stemDown ? stemY + 30 : stemY - 30;
              return <line x1={x} y1={y1} x2={x} y2={y2} stroke="#0f172a" strokeWidth="1.4" />;
            })() : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function FretboardScalesPage() {
  // --------------------------------------------------------------------------
  // REFS Y ESTADO GENERAL DE LA APP
  // --------------------------------------------------------------------------

  const appRootRef = useRef(null);
  const importConfigInputRef = useRef(null);
  const chordDetectAudioCtxRef = useRef(null);

  const [storageHydrated, setStorageHydrated] = useState(false);
  const [configNotice, setConfigNotice] = useState(null);
  const [quickPresets, setQuickPresets] = useState(() => Array.from({ length: QUICK_PRESET_COUNT }, () => null));
  const [manualOpen, setManualOpen] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  const [studyTarget, setStudyTarget] = useState("main");

  // Notación (auto / override)
  // --------------------------------------------------------------------------
  // ESTADO: ESCALAS, VISTA Y MÁSTILES
  // --------------------------------------------------------------------------

  const [accMode, setAccMode] = useState("auto"); // auto | sharps | flats
  // Vista (pueden coexistir)
  const [showIntervalsLabel, setShowIntervalsLabel] = useState(true);
  const [showNotesLabel, setShowNotesLabel] = useState(false);

  const [rootPc, setRootPc] = useState(5); // F
  const [scaleRootLetter, setScaleRootLetter] = useState("F");
  const [scaleRootAcc, setScaleRootAcc] = useState(null); // null | "flat" | "sharp"
  const [scaleName, setScaleName] = useState("Mayor");
  const [harmonyMode, setHarmonyMode] = useState("diatonic");
  const isPentatonicScale = scaleName === "Pentatónica mayor" || scaleName === "Pentatónica menor";
  const isBluesScale = scaleName === "Pentatónica menor + blue note" || scaleName === "Pentatónica mayor + blue note";
  const isKingBoxEligibleScale = isPentatonicScale || isBluesScale;
  const [maxFret, setMaxFret] = useState(15);

  const [showNonScale, setShowNonScale] = useState(false);

  const [customInput, setCustomInput] = useState("1 b3 5 6");

  // Extras (default OFF)
  const [extraInput, setExtraInput] = useState("b2");
  const [showExtra, setShowExtra] = useState(false);

  // Qué mástiles mostrar
  const [showBoards, setShowBoards] = useState({ scale: false, patterns: false, route: false, chords: true });
  const [showKingBoxes, setShowKingBoxes] = useState(false);
  const [kingBoxMode, setKingBoxMode] = useState("bb");
  const [kingBoxColors, setKingBoxColors] = useState({
    bb: KING_BOX_DEFAULTS.bb.border,
    albert: KING_BOX_DEFAULTS.albert.border,
  });

  // Modo de patrones para el 2º mástil
  const [patternsMode, setPatternsMode] = useState("auto"); // auto | boxes | nps | caged

  // --------------------------------------------------------------------------
  // ESTADO: ACORDE PRINCIPAL
  // --------------------------------------------------------------------------

  // ------------------------
  // Acordes (panel opcional)
  // ------------------------
  const [chordRootPc, setChordRootPc] = useState(5); // F
  const [chordSpellPreferSharps, setChordSpellPreferSharps] = useState(() => preferSharpsFromMajorTonicPc(5));
  const [chordFamily, setChordFamily] = useState("tertian");
  const [chordQuartalType, setChordQuartalType] = useState("pure");
  const [chordQuartalVoices, setChordQuartalVoices] = useState("4");
  const [chordQuartalSpread, setChordQuartalSpread] = useState("closed");
  const [chordQuartalReference, setChordQuartalReference] = useState("root");
  const [chordQuartalScaleName, setChordQuartalScaleName] = useState("Mayor");
  const [chordQuartalVoicingIdx, setChordQuartalVoicingIdx] = useState(0);
  const [chordQuartalSelectedFrets, setChordQuartalSelectedFrets] = useState(null);
  const [guideToneQuality, setGuideToneQuality] = useState("maj7");
  const [guideToneForm, setGuideToneForm] = useState("closed");
  const [guideToneInversion, setGuideToneInversion] = useState("all");
  const [guideToneVoicingIdx, setGuideToneVoicingIdx] = useState(0);
  const [guideToneSelectedFrets, setGuideToneSelectedFrets] = useState(null);
  const lastGuideToneVoicingRef = useRef(null);
  const skipGuideToneVoicingRefSyncRef = useRef(false);
  const [chordQuality, setChordQuality] = useState("maj");
  const [chordSuspension, setChordSuspension] = useState("none");
  const [chordStructure, setChordStructure] = useState("triad");
  const [chordInversion, setChordInversion] = useState("all");
  const [chordForm, setChordForm] = useState("open");
  const [chordPositionForm, setChordPositionForm] = useState("open");
  const [chordExt7, setChordExt7] = useState(false);
  const [chordExt6, setChordExt6] = useState(false);
  const [chordExt9, setChordExt9] = useState(false);
  const [chordExt11, setChordExt11] = useState(false);
  const [chordExt13, setChordExt13] = useState(false);
  // --------------------------------------------------------------------------
  // ESTADO: DETECCIÓN DE ACORDES EN MÁSTIL
  // --------------------------------------------------------------------------

  const [chordDetectMode, setChordDetectMode] = useState(false);
  const [chordDetectClickAudio, setChordDetectClickAudio] = useState(false);
  const [chordDetectSelectedKeys, setChordDetectSelectedKeys] = useState([]);
  const [chordDetectCandidateId, setChordDetectCandidateId] = useState(null);



  // --------------------------------------------------------------------------
  // REGLAS DE COHERENCIA DE UI (sin cambiar sonido ni funcionalidad)
  // --------------------------------------------------------------------------

  useEffect(() => {
    // m7(b5) sin 7ª no existe como triada: se degrada a disminuido.
    if (chordQuality === "hdim" && chordStructure === "triad" && !chordExt7) {
      setChordQuality("dim");
    }
    // Dominante sin 7ª no es dominante: se degrada a mayor.
    if (chordQuality === "dom" && chordStructure === "triad" && !chordExt7) {
      setChordQuality("maj");
    }
  }, [chordQuality, chordStructure, chordExt7]);

  useEffect(() => {
    if (!isDropForm(chordForm)) return;
    if (isStrictFourNoteDropEligible({
      structure: chordStructure,
      ext7: chordExt7,
      ext6: chordExt6,
      ext9: chordExt9,
      ext11: chordExt11,
      ext13: chordExt13,
    })) return;
    setChordForm(chordPositionForm || "closed");
    setChordInversion("root");
  }, [chordForm, chordPositionForm, chordStructure, chordExt7, chordExt6, chordExt9, chordExt11, chordExt13]);

  // Regla (cuatriada):
  // - Por defecto incluye 7ª.
  // - Si activas 9/11/13 (solo una), se desactiva 7ª y pasa a ser add9/add11/add13.
  useEffect(() => {
    if (chordStructure !== "tetrad") return;

    if (chordExt13) {
      if (chordExt11) setChordExt11(false);
      if (chordExt9) setChordExt9(false);
      if (chordExt6) setChordExt6(false);
    } else if (chordExt11) {
      if (chordExt9) setChordExt9(false);
      if (chordExt6) setChordExt6(false);
    } else if (chordExt9) {
      if (chordExt6) setChordExt6(false);
    }

    if (chordExt6) {
      if (chordExt9) setChordExt9(false);
      if (chordExt11) setChordExt11(false);
      if (chordExt13) setChordExt13(false);
    }

    const addCount = (chordExt6 ? 1 : 0) + (chordExt9 ? 1 : 0) + (chordExt11 ? 1 : 0) + (chordExt13 ? 1 : 0);
    setChordExt7(addCount === 0);
  }, [chordStructure, chordExt6, chordExt9, chordExt11, chordExt13]);


  // --------------------------------------------------------------------------
  // CARGA DE VOICINGS / DATASET JSON DEL ACORDE PRINCIPAL
  // --------------------------------------------------------------------------

  // Voicings de acordes (digitaciones tocables) desde dataset externo
  const [chordDb, setChordDb] = useState(null);
  const [chordDbError, setChordDbError] = useState(null);
  const [chordDbLastUrl, setChordDbLastUrl] = useState(null);
  const [chordVoicingIdx, setChordVoicingIdx] = useState(0);
  const [chordSelectedFrets, setChordSelectedFrets] = useState(null);
  const [chordMaxDist, setChordMaxDist] = useState(4);
  const [chordAllowOpenStrings, setChordAllowOpenStrings] = useState(false);
  const lastChordVoicingRef = useRef(null);
  const skipChordVoicingRefSyncRef = useRef(false);
  const pendingChordRestoreRef = useRef({ active: false, frets: null });
  const lastNearVoicingsRef = useRef([null, null, null, null]);
  const skipNearVoicingRefSyncRef = useRef([false, false, false, false]);
  const pendingNearRestoreRef = useRef([
    { active: false, frets: null },
    { active: false, frets: null },
    { active: false, frets: null },
    { active: false, frets: null },
  ]);

  // --------------------------------------------------------------------------
  // ESTADO: ACORDES CERCANOS
  // --------------------------------------------------------------------------

  // ------------------------
  // Acordes (2): acordes cercanos por rango de trastes
  // - Hasta 4 acordes (slot 1 es base)
  // - Calcula digitaciones tocables dentro del rango y ordena por cercanía al acorde base
  // ------------------------
  const [nearWindowStart, setNearWindowStart] = useState(2); // inicio del rango (traste)
  const [nearWindowSize, setNearWindowSize] = useState(6); // tamaño del rango (nº de trastes, incluye inicio)
  const [nearAutoScaleSync, setNearAutoScaleSync] = useState(true);

  // Clamp del rango a 0–maxFret
  useEffect(() => {
    const size = Math.max(1, Math.floor(Number(nearWindowSize) || 1));
    const startMax = Math.max(0, maxFret - (size - 1));
    if (size !== nearWindowSize) setNearWindowSize(size);
    setNearWindowStart((s) => {
      const v = Math.floor(Number(s) || 0);
      return Math.max(0, Math.min(startMax, v));
    });
  }, [nearWindowSize, maxFret]);

    const [nearSlots, setNearSlots] = useState(() => {
    const base = {
      enabled: true,
      rootPc: chordRootPc,
      quality: chordQuality,
      suspension: chordSuspension,
      structure: chordStructure,
      inversion: "all",
      form: "open",
      positionForm: "open",
      ext7: false,
      ext6: false,
      ext9: false,
      ext11: false,
      ext13: false,
      spellPreferSharps: chordSpellPreferSharps,
      maxDist: 4,
      allowOpenStrings: false,
      selFrets: null,
    };

    const mkEmpty = () => ({
      enabled: false,
      rootPc: chordRootPc,
      quality: "maj",
      suspension: "none",
      structure: "triad",
      inversion: "all",
      form: "open",
      positionForm: "open",
      ext7: false,
      ext6: false,
      ext9: false,
      ext11: false,
      ext13: false,
      spellPreferSharps: chordSpellPreferSharps,
      maxDist: 4,
      allowOpenStrings: false,
      selFrets: null,
    });

    return [base, mkEmpty(), mkEmpty(), mkEmpty()];
  });

  useEffect(() => {
    setNearSlots((prev) => {
      let changed = false;
      const next = prev.map((slot) => {
        if (!slot) return slot;
        if (!isDropForm(slot.form)) return slot;
        if (isStrictFourNoteDropEligible({
          structure: slot.structure,
          ext7: slot.ext7,
          ext6: slot.ext6,
          ext9: slot.ext9,
          ext11: slot.ext11,
          ext13: slot.ext13,
        })) return slot;
        changed = true;
        return { ...slot, form: slot.positionForm || "closed", inversion: "root", selFrets: null };
      });
      return changed ? next : prev;
    });
  }, [nearSlots.map((s) => `${s?.form}|${s?.structure}|${s?.ext7 ? 1 : 0}|${s?.ext6 ? 1 : 0}|${s?.ext9 ? 1 : 0}|${s?.ext11 ? 1 : 0}|${s?.ext13 ? 1 : 0}`).join(";")]);

  useEffect(() => {
    if (!storageHydrated) return;
    setNearSlots((prev) => {
      let changed = false;
      const next = prev.map((slot) => {
        if (!slot) return slot;
        if (slot.structure !== "tetrad") return slot;

        let ext6 = !!slot.ext6;
        let ext9 = !!slot.ext9;
        let ext11 = !!slot.ext11;
        let ext13 = !!slot.ext13;

        if (ext13) {
          ext11 = false;
          ext9 = false;
          ext6 = false;
        } else if (ext11) {
          ext9 = false;
          ext6 = false;
        } else if (ext9) {
          ext6 = false;
        }

        if (ext6) {
          ext9 = false;
          ext11 = false;
          ext13 = false;
        }

        const addCount = (ext6 ? 1 : 0) + (ext9 ? 1 : 0) + (ext11 ? 1 : 0) + (ext13 ? 1 : 0);
        const ext7 = addCount === 0;

        if (ext6 !== !!slot.ext6 || ext9 !== !!slot.ext9 || ext11 !== !!slot.ext11 || ext13 !== !!slot.ext13 || ext7 !== !!slot.ext7) {
          changed = true;
          return { ...slot, ext6, ext7, ext9, ext11, ext13, selFrets: null };
        }
        return slot;
      });
      return changed ? next : prev;
    });
  }, [nearSlots.map((s) => `${s?.structure}|${s?.ext6 ? 1 : 0}|${s?.ext7 ? 1 : 0}|${s?.ext9 ? 1 : 0}|${s?.ext11 ? 1 : 0}|${s?.ext13 ? 1 : 0}`).join(";")]);

  useEffect(() => {
    setNearSlots((prev) => {
      let changed = false;
      const next = prev.map((slot) => {
        if (!slot) return slot;
        let quality = slot.quality;
        if (quality === "hdim" && slot.structure === "triad" && !slot.ext7) quality = "dim";
        if (quality === "dom" && slot.structure === "triad" && !slot.ext7) quality = "maj";
        if (quality !== slot.quality) {
          changed = true;
          return { ...slot, quality, selFrets: null };
        }
        return slot;
      });
      return changed ? next : prev;
    });
  }, [nearSlots.map((s) => `${s?.quality}|${s?.structure}|${s?.ext7 ? 1 : 0}`).join(";")]);

  const [nearBgColors, setNearBgColors] = useState([
    "#8ACAF4", // Acorde 1 (base)  RGB(138,202,244)
    "#8DE8AD", // Acorde 2        RGB(141,232,173)
    "#FFF475", // Acorde 3        RGB(255,244,117)
    "#F53845", // Acorde 4        RGB(245,56,69)
  ]);
  const [clusterTestDots, setClusterTestDots] = useState([
    { x: 35, y: 6, size: 21, color: "#ef4444" },
    { x: 12, y: 14, size: 21, color: "#f59e0b" },
    { x: 57, y: 14, size: 21, color: "#10b981" },
    { x: 34, y: 25, size: 21, color: "#3b82f6" },
  ]);

  const [chordDbCache, setChordDbCache] = useState({}); // key => json
  const [chordDbCacheErr, setChordDbCacheErr] = useState({}); // key => string

  // --------------------------------------------------------------------------
  // ESTADO: RUTA MUSICAL
  // --------------------------------------------------------------------------

  // Ruta
  const [routeLabStartCode, setRouteLabStartCode] = useState("61");
  const [routeLabEndCode, setRouteLabEndCode] = useState("113");
  const [routeLabMaxPerString, setRouteLabMaxPerString] = useState(4);
  const [routeLabPickNext, setRouteLabPickNext] = useState("start");
  const [routeLabSwitchWhenSameStringForwardPenalty, setRouteLabSwitchWhenSameStringForwardPenalty] = useState(ROUTE_LAB_DEFAULT_TUNING.switchWhenSameStringForwardPenalty);
  const [routeLabWorseThanSameStringGoalBase, setRouteLabWorseThanSameStringGoalBase] = useState(ROUTE_LAB_DEFAULT_TUNING.worseThanSameStringGoalBase);
  const [routeLabWorseThanSameStringGoalScale, setRouteLabWorseThanSameStringGoalScale] = useState(ROUTE_LAB_DEFAULT_TUNING.worseThanSameStringGoalScale);
  const [routeLabCorridorPenalty, setRouteLabCorridorPenalty] = useState(ROUTE_LAB_DEFAULT_TUNING.corridorPenalty);
  const [routeLabOvershootNearEndAlt, setRouteLabOvershootNearEndAlt] = useState(ROUTE_LAB_DEFAULT_TUNING.overshootNearEndAlt);

  const [routeStartCode, setRouteStartCode] = useState("61");
  const [routeEndCode, setRouteEndCode] = useState("113");
  const [routeMaxPerString, setRouteMaxPerString] = useState(4);
  const [routeMode, setRouteMode] = useState("auto"); // auto | free | penta | nps | pos
  const [routePreferNps, setRoutePreferNps] = useState(true);
  const [routePreferVertical, setRoutePreferVertical] = useState(false);
  const [routeStrictFretDirection, setRouteStrictFretDirection] = useState(false);
  const [routeKeepPattern, setRouteKeepPattern] = useState(false);
  const [allowPatternSwitch, setAllowPatternSwitch] = useState(true);
  const [patternSwitchPenalty, setPatternSwitchPenalty] = useState(2.0);
  const [routeFixedPattern, setRouteFixedPattern] = useState("auto");
  const [routePickNext, setRoutePickNext] = useState("start"); // start | end

  // --------------------------------------------------------------------------
  // ESTADO: COLORES Y APARIENCIA
  // --------------------------------------------------------------------------

  // Colores
  const [colors, setColors] = useState({
    root: "#e11d48",
    third: "#0284c7",
    fifth: "#059669",
    other: "#bababa",
    extra: "#f59e0b",
    route: "#a78bfa",
    seventh: "#edbc07",
    sixth: "#d2b7b7",
    ninth: "#c99ed1",
    eleventh: "#b0a2e2",
    thirteenth: "#88f2c9",
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

  // --------------------------------------------------------------------------
  // PERSISTENCIA / EXPORTACIÓN / PRESETS
  // --------------------------------------------------------------------------

  const persistedUiConfig = useMemo(() => ({
    accMode,
    showIntervalsLabel,
    showNotesLabel,
    showKingBoxes,
    kingBoxMode,
    kingBoxColors,
    rootPc,
    harmonyMode,
    scaleRootLetter,
    scaleRootAcc,
    scaleName,
    maxFret,
    showNonScale,
    customInput,
    extraInput,
    showExtra,
    showBoards,
    patternsMode,
    chordRootPc,
    chordSpellPreferSharps,
    chordFamily,
    chordQuartalType,
    chordQuartalVoices,
    chordQuartalSpread,
    chordQuartalReference,
    chordQuartalScaleName,
    chordQuartalVoicingIdx,
    chordQuartalSelectedFrets,
    guideToneQuality,
    guideToneForm,
    guideToneInversion,
    guideToneVoicingIdx,
    guideToneSelectedFrets,
    chordQuality,
    chordSuspension,
    chordStructure,
    chordInversion,
    chordForm,
    chordPositionForm,
    chordExt7,
    chordExt6,
    chordExt9,
    chordExt11,
    chordExt13,
    chordVoicingIdx,
    chordSelectedFrets,
    chordMaxDist,
    chordAllowOpenStrings,
    nearWindowStart,
    nearWindowSize,
    nearAutoScaleSync,
    nearSlots,
    nearBgColors,
    routeStartCode,
    routeEndCode,
    routeMaxPerString,
    routeLabStartCode,
    routeLabEndCode,
    routeLabMaxPerString,
    routeLabSwitchWhenSameStringForwardPenalty,
    routeLabWorseThanSameStringGoalBase,
    routeLabWorseThanSameStringGoalScale,
    routeLabCorridorPenalty,
    routeLabOvershootNearEndAlt,
    routeMode,
    routePreferNps,
    routePreferVertical,
    routeStrictFretDirection,
    routeKeepPattern,
    allowPatternSwitch,
    patternSwitchPenalty,
    routeFixedPattern,
    routePickNext,
    colors,
    patternColors,
  }), [
    accMode,
    showIntervalsLabel,
    showNotesLabel,
    showKingBoxes,
    kingBoxMode,
    kingBoxColors,
    rootPc,
    harmonyMode,
    scaleRootLetter,
    scaleRootAcc,
    scaleName,
    maxFret,
    showNonScale,
    customInput,
    extraInput,
    showExtra,
    showBoards,
    patternsMode,
    chordRootPc,
    chordSpellPreferSharps,
    chordFamily,
    chordQuartalType,
    chordQuartalVoices,
    chordQuartalSpread,
    chordQuartalReference,
    chordQuartalScaleName,
    guideToneQuality,
    guideToneForm,
    guideToneInversion,
    guideToneVoicingIdx,
    guideToneSelectedFrets,
    chordQuality,
    chordSuspension,
    chordStructure,
    chordInversion,
    chordForm,
    chordPositionForm,
    chordExt7,
    chordExt6,
    chordExt9,
    chordExt11,
    chordExt13,
    chordVoicingIdx,
    chordSelectedFrets,
    chordMaxDist,
    chordAllowOpenStrings,
    nearWindowStart,
    nearWindowSize,
    nearAutoScaleSync,
    nearSlots,
    nearBgColors,
    routeStartCode,
    routeEndCode,
    routeMaxPerString,
    routeMode,
    routePreferNps,
    routePreferVertical,
    routeStrictFretDirection,
    routeKeepPattern,
    allowPatternSwitch,
    patternSwitchPenalty,
    routeFixedPattern,
    routePickNext,
    colors,
    patternColors,
  ]);

  const persistedUiPayload = useMemo(() => ({
    version: UI_CONFIG_VERSION,
    appVersion: APP_VERSION,
    config: persistedUiConfig,
  }), [persistedUiConfig]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") {
        setStorageHydrated(true);
        return;
      }

      const presetRaw = window.localStorage.getItem(UI_PRESETS_STORAGE_KEY);
      if (presetRaw) {
        try {
          setQuickPresets(sanitizePresetCollection(JSON.parse(presetRaw)));
        } catch {
        }
      }

      const queuedNotice = window.sessionStorage.getItem(UI_STATUS_SESSION_KEY);
      if (queuedNotice) {
        try {
          const parsedNotice = JSON.parse(queuedNotice);
          if (parsedNotice && typeof parsedNotice === "object") setConfigNotice(parsedNotice);
        } catch {
        }
        window.sessionStorage.removeItem(UI_STATUS_SESSION_KEY);
      }
      const raw = window.localStorage.getItem(UI_STORAGE_KEY);
      if (!raw) {
        setStorageHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw);
      const payload = unwrapPersistedPayload(parsed);
      const saved = payload.config || {};
      if (payload.version && payload.version !== UI_CONFIG_VERSION) {
        setConfigNotice({ type: "info", text: `Configuración antigua (v${payload.version}) cargada con saneado.` });
      }

      if ("accMode" in saved) setAccMode(sanitizeOneOf(saved.accMode, ["auto", "sharps", "flats"], "auto"));
      if ("showIntervalsLabel" in saved) setShowIntervalsLabel(sanitizeBoolValue(saved.showIntervalsLabel, true));
      if ("showNotesLabel" in saved) setShowNotesLabel(sanitizeBoolValue(saved.showNotesLabel, false));
      if ("showKingBoxes" in saved) setShowKingBoxes(sanitizeBoolValue(saved.showKingBoxes, false));
      if ("kingBoxMode" in saved) setKingBoxMode(sanitizeOneOf(saved.kingBoxMode, ["bb", "albert", "both"], "bb"));
      if (saved.kingBoxColors && typeof saved.kingBoxColors === "object") {
        setKingBoxColors((prev) => ({
          bb: sanitizeColorValue(saved.kingBoxColors.bb, prev.bb),
          albert: sanitizeColorValue(saved.kingBoxColors.albert, prev.albert),
        }));
      }
      if ("rootPc" in saved) setRootPc(sanitizeNumberValue(saved.rootPc, 5, 0, 11));
      if ("harmonyMode" in saved) setHarmonyMode(sanitizeOneOf(saved.harmonyMode, ["diatonic", "functional_minor"], "diatonic"));
      if ("scaleRootLetter" in saved) setScaleRootLetter(sanitizeOneOf(saved.scaleRootLetter, LETTERS, "F"));
      if ("scaleRootAcc" in saved) setScaleRootAcc(saved.scaleRootAcc == null ? null : sanitizeOneOf(saved.scaleRootAcc, ["flat", "sharp"], null));
      if ("scaleName" in saved) setScaleName(sanitizeOneOf(normalizeScaleName(saved.scaleName), Object.keys(SCALE_PRESETS), "Mayor"));
      if ("maxFret" in saved) setMaxFret(sanitizeNumberValue(saved.maxFret, 15, 12, 24));
      if ("showNonScale" in saved) setShowNonScale(sanitizeBoolValue(saved.showNonScale, false));
      if ("customInput" in saved && typeof saved.customInput === "string") setCustomInput(saved.customInput);
      if ("extraInput" in saved && typeof saved.extraInput === "string") setExtraInput(saved.extraInput);
      if ("showExtra" in saved) setShowExtra(sanitizeBoolValue(saved.showExtra, false));
      if (saved.showBoards && typeof saved.showBoards === "object") {
        setShowBoards((prev) => ({
          ...prev,
          scale: sanitizeBoolValue(saved.showBoards.scale, prev.scale),
          patterns: sanitizeBoolValue(saved.showBoards.patterns, prev.patterns),
          route: sanitizeBoolValue(saved.showBoards.route, prev.route),
          chords: sanitizeBoolValue(saved.showBoards.chords, prev.chords),
        }));
      }
      if ("patternsMode" in saved) setPatternsMode(sanitizeOneOf(saved.patternsMode, ["auto", "boxes", "nps", "caged"], "auto"));

      if ("chordRootPc" in saved) setChordRootPc(sanitizeNumberValue(saved.chordRootPc, 5, 0, 11));
      if ("chordSpellPreferSharps" in saved) setChordSpellPreferSharps(sanitizeBoolValue(saved.chordSpellPreferSharps, true));
      if ("chordFamily" in saved) setChordFamily(sanitizeOneOf(saved.chordFamily, CHORD_FAMILIES.map((x) => x.value), "tertian"));
      if ("chordQuartalType" in saved) setChordQuartalType(sanitizeOneOf(saved.chordQuartalType, CHORD_QUARTAL_TYPES.map((x) => x.value), "pure"));
      if ("chordQuartalVoices" in saved) setChordQuartalVoices(sanitizeOneOf(String(saved.chordQuartalVoices), CHORD_QUARTAL_VOICES.map((x) => x.value), "4"));
      if ("chordQuartalSpread" in saved) setChordQuartalSpread(sanitizeOneOf(saved.chordQuartalSpread, CHORD_QUARTAL_SPREADS.map((x) => x.value), "closed"));
      if ("chordQuartalReference" in saved) setChordQuartalReference(sanitizeOneOf(saved.chordQuartalReference, CHORD_QUARTAL_REFERENCES.map((x) => x.value), "root"));
      if ("chordQuartalScaleName" in saved) setChordQuartalScaleName(sanitizeOneOf(normalizeScaleName(saved.chordQuartalScaleName), CHORD_QUARTAL_SCALE_NAMES, "Mayor"));
      if ("chordQuartalVoicingIdx" in saved) setChordQuartalVoicingIdx(Math.max(0, sanitizeNumberValue(saved.chordQuartalVoicingIdx, 0, 0, 9999)));
      if ("chordQuartalSelectedFrets" in saved) setChordQuartalSelectedFrets(typeof saved.chordQuartalSelectedFrets === "string" ? saved.chordQuartalSelectedFrets : null);
      if ("guideToneQuality" in saved) setGuideToneQuality(sanitizeOneOf(saved.guideToneQuality, CHORD_GUIDE_TONE_QUALITIES.map((q) => q.value), "maj7"));
      if ("guideToneForm" in saved) setGuideToneForm(sanitizeOneOf(saved.guideToneForm, CHORD_GUIDE_TONE_FORMS.map((x) => x.value), "closed"));
      if ("guideToneInversion" in saved) setGuideToneInversion(sanitizeOneOf(saved.guideToneInversion, CHORD_GUIDE_TONE_INVERSIONS.map((x) => x.value), "all"));
      if ("guideToneVoicingIdx" in saved) setGuideToneVoicingIdx(sanitizeNumberValue(saved.guideToneVoicingIdx, 0, 0, 999));
      if ("guideToneSelectedFrets" in saved) setGuideToneSelectedFrets(typeof saved.guideToneSelectedFrets === "string" ? saved.guideToneSelectedFrets : null);
      if ("chordQuality" in saved) setChordQuality(sanitizeOneOf(saved.chordQuality, CHORD_QUALITIES.map((q) => q.value), "maj"));
      if ("chordSuspension" in saved) setChordSuspension(sanitizeOneOf(saved.chordSuspension, ["none", "sus2", "sus4"], "none"));
      if ("chordStructure" in saved) setChordStructure(sanitizeOneOf(saved.chordStructure, CHORD_STRUCTURES.map((s) => s.value), "triad"));
      if ("chordInversion" in saved) setChordInversion(sanitizeOneOf(saved.chordInversion, CHORD_INVERSIONS.map((x) => x.value), "root"));
      if ("chordForm" in saved) {
        const restoredChordForm = sanitizeOneOf(saved.chordForm, CHORD_FORMS.map((x) => x.value), "open");
        setChordForm(restoredChordForm);
        const restoredPosition = "chordPositionForm" in saved
          ? sanitizeOneOf(saved.chordPositionForm, ["closed", "open"], positionFormFromEffectiveForm(restoredChordForm))
          : positionFormFromEffectiveForm(restoredChordForm);
        setChordPositionForm(restoredPosition);
      } else if ("chordPositionForm" in saved) {
        setChordPositionForm(sanitizeOneOf(saved.chordPositionForm, ["closed", "open"], "open"));
      }
      if ("chordExt7" in saved) setChordExt7(sanitizeBoolValue(saved.chordExt7, false));
      if ("chordExt6" in saved) setChordExt6(sanitizeBoolValue(saved.chordExt6, false));
      if ("chordExt9" in saved) setChordExt9(sanitizeBoolValue(saved.chordExt9, false));
      if ("chordExt11" in saved) setChordExt11(sanitizeBoolValue(saved.chordExt11, false));
      if ("chordExt13" in saved) setChordExt13(sanitizeBoolValue(saved.chordExt13, false));
      if ("chordVoicingIdx" in saved) setChordVoicingIdx(sanitizeNumberValue(saved.chordVoicingIdx, 0, 0, 999));
      if ("chordSelectedFrets" in saved) {
        const restored = typeof saved.chordSelectedFrets === "string" || saved.chordSelectedFrets == null ? saved.chordSelectedFrets : null;
        setChordSelectedFrets(restored);
        pendingChordRestoreRef.current = { active: true, frets: restored };
      }
      if ("chordMaxDist" in saved) setChordMaxDist(sanitizeOneOf(Number(saved.chordMaxDist), [4, 5, 6], 4));
      if ("chordAllowOpenStrings" in saved) setChordAllowOpenStrings(sanitizeBoolValue(saved.chordAllowOpenStrings, false));

      if ("nearWindowStart" in saved) setNearWindowStart(sanitizeNumberValue(saved.nearWindowStart, 2, 0, 24));
      if ("nearWindowSize" in saved) setNearWindowSize(sanitizeNumberValue(saved.nearWindowSize, 6, 1, 24));
      if ("nearAutoScaleSync" in saved) setNearAutoScaleSync(sanitizeBoolValue(saved.nearAutoScaleSync, true));
      if (Array.isArray(saved.nearSlots)) {
        pendingNearRestoreRef.current = Array.from({ length: 4 }, (_, i) => ({
          active: true,
          frets: typeof saved.nearSlots[i]?.selFrets === "string" || saved.nearSlots[i]?.selFrets == null ? (saved.nearSlots[i]?.selFrets ?? null) : null,
        }));
        setNearSlots((prev) => prev.map((slot, i) => sanitizeNearSlotValue(saved.nearSlots[i], slot)));
      }
      if (Array.isArray(saved.nearBgColors)) {
        setNearBgColors((prev) => prev.map((c, i) => sanitizeColorValue(saved.nearBgColors[i], c)));
      }

      if ("routeStartCode" in saved && typeof saved.routeStartCode === "string") setRouteStartCode(saved.routeStartCode);
      if ("routeEndCode" in saved && typeof saved.routeEndCode === "string") setRouteEndCode(saved.routeEndCode);
      if ("routeMaxPerString" in saved) setRouteMaxPerString(sanitizeNumberValue(saved.routeMaxPerString, 4, 1, 5));
      if ("routeLabStartCode" in saved && typeof saved.routeLabStartCode === "string") setRouteLabStartCode(saved.routeLabStartCode);
      if ("routeLabEndCode" in saved && typeof saved.routeLabEndCode === "string") setRouteLabEndCode(saved.routeLabEndCode);
      if ("routeLabMaxPerString" in saved) setRouteLabMaxPerString(sanitizeNumberValue(saved.routeLabMaxPerString, 4, 1, 5));
      if ("routeLabSwitchWhenSameStringForwardPenalty" in saved) setRouteLabSwitchWhenSameStringForwardPenalty(sanitizeNumberValue(saved.routeLabSwitchWhenSameStringForwardPenalty, ROUTE_LAB_DEFAULT_TUNING.switchWhenSameStringForwardPenalty, 0, 12));
      if ("routeLabWorseThanSameStringGoalBase" in saved) setRouteLabWorseThanSameStringGoalBase(sanitizeNumberValue(saved.routeLabWorseThanSameStringGoalBase, ROUTE_LAB_DEFAULT_TUNING.worseThanSameStringGoalBase, 0, 12));
      if ("routeLabWorseThanSameStringGoalScale" in saved) setRouteLabWorseThanSameStringGoalScale(sanitizeNumberValue(saved.routeLabWorseThanSameStringGoalScale, ROUTE_LAB_DEFAULT_TUNING.worseThanSameStringGoalScale, 0, 6));
      if ("routeLabCorridorPenalty" in saved) setRouteLabCorridorPenalty(sanitizeNumberValue(saved.routeLabCorridorPenalty, ROUTE_LAB_DEFAULT_TUNING.corridorPenalty, 0, 4));
      if ("routeLabOvershootNearEndAlt" in saved) setRouteLabOvershootNearEndAlt(sanitizeNumberValue(saved.routeLabOvershootNearEndAlt, ROUTE_LAB_DEFAULT_TUNING.overshootNearEndAlt, 0, 16));
      if ("routeMode" in saved) setRouteMode(sanitizeOneOf(saved.routeMode, ["auto", "free", "pos", "nps", "penta", "caged"], "auto"));
      if ("routePreferNps" in saved) setRoutePreferNps(sanitizeBoolValue(saved.routePreferNps, true));
      if ("routePreferVertical" in saved) setRoutePreferVertical(sanitizeBoolValue(saved.routePreferVertical, false));
      if ("routeStrictFretDirection" in saved) setRouteStrictFretDirection(sanitizeBoolValue(saved.routeStrictFretDirection, false));
      if ("routeKeepPattern" in saved) setRouteKeepPattern(sanitizeBoolValue(saved.routeKeepPattern, false));
      if ("allowPatternSwitch" in saved) setAllowPatternSwitch(sanitizeBoolValue(saved.allowPatternSwitch, true));
      if ("patternSwitchPenalty" in saved) setPatternSwitchPenalty(sanitizeNumberValue(saved.patternSwitchPenalty, 2, 0, 6));
      if ("routeFixedPattern" in saved && typeof saved.routeFixedPattern === "string") setRouteFixedPattern(saved.routeFixedPattern);
      if ("routePickNext" in saved) setRoutePickNext(sanitizeOneOf(saved.routePickNext, ["start", "end"], "start"));

      if (saved.colors && typeof saved.colors === "object") {
        setColors((prev) => ({
          ...prev,
          root: sanitizeColorValue(saved.colors.root, prev.root),
          third: sanitizeColorValue(saved.colors.third, prev.third),
          fifth: sanitizeColorValue(saved.colors.fifth, prev.fifth),
          other: sanitizeColorValue(saved.colors.other, prev.other),
          extra: sanitizeColorValue(saved.colors.extra, prev.extra),
          route: sanitizeColorValue(saved.colors.route, prev.route),
          seventh: sanitizeColorValue(saved.colors.seventh, prev.seventh),
          sixth: sanitizeColorValue(saved.colors.sixth, prev.sixth),
          ninth: sanitizeColorValue(saved.colors.ninth, prev.ninth),
          eleventh: sanitizeColorValue(saved.colors.eleventh, prev.eleventh),
          thirteenth: sanitizeColorValue(saved.colors.thirteenth, prev.thirteenth),
        }));
      }
      if (Array.isArray(saved.patternColors)) {
        setPatternColors((prev) => prev.map((c, i) => sanitizeColorValue(saved.patternColors[i], c)));
      }
    } catch {
      setConfigNotice({ type: "error", text: "Configuración guardada inválida. Se usaron valores seguros." });
    } finally {
      setStorageHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!storageHydrated) return;
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(persistedUiPayload));
    } catch {
    }
  }, [storageHydrated, persistedUiPayload]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(UI_PRESETS_STORAGE_KEY, JSON.stringify(quickPresets));
    } catch {
    }
  }, [quickPresets]);

  useEffect(() => {
    if (!configNotice) return;
    const t = window.setTimeout(() => setConfigNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [configNotice]);

  function queueReloadNotice(type, text) {
    try {
      if (typeof window === "undefined") return;
      window.sessionStorage.setItem(UI_STATUS_SESSION_KEY, JSON.stringify({ type, text }));
    } catch {
    }
  }

  function exportUiConfig() {
    try {
      const raw = JSON.stringify(persistedUiPayload, null, 2);
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
      a.href = url;
      a.download = `mastil_interactivo_config_${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setConfigNotice({ type: "success", text: "Configuración exportada." });
    } catch {
      setConfigNotice({ type: "error", text: "No pude exportar la configuración." });
    }
  }

  function buildImportedPayload(parsed) {
    const payload = unwrapPersistedPayload(parsed);
    return {
      version: UI_CONFIG_VERSION,
      appVersion: APP_VERSION,
      config: payload.config || {},
    };
  }

  function importUiConfigFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result || "");
        const parsed = JSON.parse(raw);
        const payload = buildImportedPayload(parsed);
        if (typeof window === "undefined") return;
        window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(payload));
        queueReloadNotice("success", "Configuración importada.");
        window.location.reload();
      } catch (e) {
        const msg = `No pude importar la configuración: ${String(e?.message || e)}`;
        setConfigNotice({ type: "error", text: msg });
        if (typeof window !== "undefined") window.alert(msg);
      }
    };
    reader.readAsText(file);
  }

  function resetUiConfig() {
    try {
      if (typeof window === "undefined") return;
      const ok = window.confirm("Se borrará la configuración guardada y se recargará la página. ¿Continuar?");
      if (!ok) return;
      window.localStorage.removeItem(UI_STORAGE_KEY);
      queueReloadNotice("info", "Configuración restablecida.");
      window.location.reload();
    } catch {
    }
  }

  function resetRouteLabTuning() {
    setRouteLabSwitchWhenSameStringForwardPenalty(ROUTE_LAB_DEFAULT_TUNING.switchWhenSameStringForwardPenalty);
    setRouteLabWorseThanSameStringGoalBase(ROUTE_LAB_DEFAULT_TUNING.worseThanSameStringGoalBase);
    setRouteLabWorseThanSameStringGoalScale(ROUTE_LAB_DEFAULT_TUNING.worseThanSameStringGoalScale);
    setRouteLabCorridorPenalty(ROUTE_LAB_DEFAULT_TUNING.corridorPenalty);
    setRouteLabOvershootNearEndAlt(ROUTE_LAB_DEFAULT_TUNING.overshootNearEndAlt);
  }

  function saveQuickPreset(slotIdx) {
    try {
      if (typeof window === "undefined") return;
      const currentName = quickPresets[slotIdx]?.name || `Preset ${slotIdx + 1}`;
      const asked = window.prompt(`Nombre para el preset ${slotIdx + 1}:`, currentName);
      if (asked === null) return;
      const name = cleanUiText(asked) || `Preset ${slotIdx + 1}`;
      setQuickPresets((prev) => {
        const next = [...prev];
        next[slotIdx] = {
          name,
          savedAt: new Date().toISOString(),
          payload: persistedUiPayload,
        };
        return next;
      });
      setConfigNotice({ type: "success", text: `Preset ${slotIdx + 1} guardado.` });
    } catch {
      setConfigNotice({ type: "error", text: "No pude guardar el preset." });
    }
  }

  function loadQuickPreset(slotIdx) {
    try {
      const preset = quickPresets[slotIdx];
      if (!preset?.payload) {
        setConfigNotice({ type: "error", text: `El preset ${slotIdx + 1} está vacío.` });
        return;
      }
      if (typeof window === "undefined") return;
      window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(preset.payload));
      queueReloadNotice("success", `Preset ${slotIdx + 1} cargado.`);
      window.location.reload();
    } catch {
      setConfigNotice({ type: "error", text: "No pude cargar el preset." });
    }
  }

  // --------------------------------------------------------------------------
  // CÁLCULOS DERIVADOS: ESCALA ACTIVA, PCS Y DELETREO
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // CÁLCULOS DERIVADOS: ESCALA ACTIVA, PCS Y DELETREO
  // --------------------------------------------------------------------------

  const scaleIntervals = useMemo(() => buildScaleIntervals(scaleName, customInput, rootPc), [scaleName, customInput, rootPc]);

  useEffect(() => {
    const root = appRootRef.current;
    if (!root) return;

    const controls = root.querySelectorAll("select, input, button");
    controls.forEach((el) => {
      const title = cleanUiText(el.getAttribute("title"));
      if (title) return;
      const inferred = inferControlTitle(el);
      if (inferred) el.setAttribute("title", inferred);
    });
  });

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

  // --------------------------------------------------------------------------
  // CÁLCULOS DERIVADOS: ACORDE PRINCIPAL
  // --------------------------------------------------------------------------

  // Acordes: ortografía del nombre (C# vs Db). No depende de la notación global.
  const chordPreferSharps = chordSpellPreferSharps;

  // Deletreo armónico del acorde: evita cosas como D–Gb–A (debe ser D–F#–A)
  const chordPcToSpelledName = (pc) => {
    const interval = mod12(pc - chordRootPc);
    const localSpelledChordNotes = spellChordNotes({ rootPc: chordRootPc, chordIntervals, preferSharps: chordPreferSharps });
    const idx = chordIntervals.findIndex((x) => mod12(x) === interval);
    return idx >= 0 ? localSpelledChordNotes[idx] : pcToName(pc, chordPreferSharps);
  };

  const chordNoteOptions = useMemo(() => {
    const list = chordPreferSharps ? NOTES_SHARP : NOTES_FLAT;
    return list.map((n, i) => ({ label: n, pc: i }));
  }, [chordPreferSharps]);

  const chordQuartalPitchSets = useMemo(() => {
    return fnBuildQuartalPitchSets({
      rootPc: chordRootPc,
      voices: chordQuartalVoices,
      type: chordQuartalType,
      reference: chordQuartalReference,
      scaleName: chordQuartalScaleName,
    });
  }, [chordRootPc, chordQuartalVoices, chordQuartalType, chordQuartalReference, chordQuartalScaleName]);

  const chordQuartalVoicings = useMemo(() => {
    const all = fnGenerateQuartalVoicings({
      pitchSets: chordQuartalPitchSets,
      maxDist: chordMaxDist,
      allowOpenStrings: chordAllowOpenStrings,
      maxFret,
    });

    return all.filter((v) => {
      const kind = v?.quartalSpreadKind || "closed";
      return chordQuartalSpread === "open" ? kind === "open" : kind === "closed";
    });
  }, [chordQuartalPitchSets, chordMaxDist, chordAllowOpenStrings, chordQuartalSpread, maxFret]);

  useEffect(() => {
    if (!chordQuartalVoicings.length) {
      setChordQuartalVoicingIdx(0);
      setChordQuartalSelectedFrets(null);
      return;
    }

    if (chordQuartalSelectedFrets) {
      const idx = chordQuartalVoicings.findIndex((v) => v.frets === chordQuartalSelectedFrets);
      if (idx >= 0) {
        setChordQuartalVoicingIdx(idx);
        return;
      }
    }

    setChordQuartalVoicingIdx(0);
    setChordQuartalSelectedFrets(chordQuartalVoicings[0].frets);
  }, [chordQuartalVoicings, chordQuartalSelectedFrets]);

  const activeQuartalVoicingRaw = chordQuartalVoicings[chordQuartalVoicingIdx] || null;

  const activeQuartalVoicing = useMemo(() => {
    if (!activeQuartalVoicingRaw) return null;
    if (Array.isArray(activeQuartalVoicingRaw.notes)) return activeQuartalVoicingRaw;
    return { ...activeQuartalVoicingRaw, notes: [] };
  }, [activeQuartalVoicingRaw]);

  const chordQuartalCurrentRootPc = useMemo(() => {
    const pcs = Array.isArray(activeQuartalVoicing?.quartalOrderedPcs) && activeQuartalVoicing.quartalOrderedPcs.length
      ? activeQuartalVoicing.quartalOrderedPcs
      : Array.isArray(chordQuartalPitchSets?.[0]?.pcs) && chordQuartalPitchSets[0].pcs.length
        ? chordQuartalPitchSets[0].pcs
        : null;

    return pcs ? mod12(pcs[0]) : chordRootPc;
  }, [activeQuartalVoicing, chordQuartalPitchSets, chordRootPc]);

  const chordQuartalDegreeText = useMemo(() => {
    if (chordQuartalReference !== "scale") return "";
    return fnBuildQuartalDegreeLabel(activeQuartalVoicing?.quartalDegree);
  }, [chordQuartalReference, activeQuartalVoicing]);

  const chordQuartalDisplayName = useMemo(() => {
    const rootName = pcToName(chordQuartalCurrentRootPc, chordPreferSharps);
    const typeLabel = CHORD_QUARTAL_TYPES.find((x) => x.value === chordQuartalType)?.label || "Cuartal puro";
    return `${rootName} ${typeLabel}`;
  }, [chordQuartalCurrentRootPc, chordPreferSharps, chordQuartalType]);

  const chordQuartalUiText = useMemo(() => {
    const voicesLabel = CHORD_QUARTAL_VOICES.find((x) => x.value === chordQuartalVoices)?.label || "4 voces";
    const spreadLabel = CHORD_QUARTAL_SPREADS.find((x) => x.value === chordQuartalSpread)?.label || "Cerrado";
    const tonicName = pcToName(chordRootPc, chordPreferSharps);
    const referenceLabel = chordQuartalReference === "scale"
      ? `Diatónico a la escala ${chordQuartalScaleName} de ${tonicName}`
      : `Desde raíz de ${tonicName}`;
    const degreeText = chordQuartalDegreeText ? ` · ${chordQuartalDegreeText}` : "";
    return `${voicesLabel} · ${spreadLabel} · ${referenceLabel}${degreeText}`;
  }, [chordQuartalVoices, chordQuartalSpread, chordQuartalReference, chordQuartalScaleName, chordQuartalDegreeText, chordRootPc, chordPreferSharps]);

  const chordQuartalStepText = useMemo(() => {
    if (!activeQuartalVoicing?.quartalSteps?.length) return "";
    return activeQuartalVoicing.quartalSteps.map((v) => (v === 6 ? "A4" : "4J")).join(" · ");
  }, [activeQuartalVoicing]);

  const chordQuartalBadgeItems = useMemo(() => {
    const orderedPcs = Array.isArray(activeQuartalVoicing?.quartalOrderedPcs) && activeQuartalVoicing.quartalOrderedPcs.length
      ? activeQuartalVoicing.quartalOrderedPcs
      : (Array.isArray(chordQuartalPitchSets?.[0]?.pcs) ? chordQuartalPitchSets[0].pcs : []);

    return orderedPcs.map((pc) => {
      const interval = mod12(pc - chordQuartalCurrentRootPc);
      const degreeRaw = intervalToSimpleChordDegreeToken(interval);
      return {
        note: spellNoteFromChordInterval(chordQuartalCurrentRootPc, interval, chordPreferSharps),
        degree: formatChordBadgeDegree(degreeRaw),
        role: chordBadgeRoleFromDegreeLabel(degreeRaw, interval),
      };
    });
  }, [activeQuartalVoicing, chordQuartalPitchSets, chordQuartalCurrentRootPc, chordPreferSharps]);

  const chordQuartalBassNote = useMemo(() => {
    if (activeQuartalVoicing?.bassPc == null) return null;
    const interval = mod12(activeQuartalVoicing.bassPc - chordQuartalCurrentRootPc);
    return spellNoteFromChordInterval(chordQuartalCurrentRootPc, interval, chordPreferSharps);
  }, [activeQuartalVoicing, chordQuartalCurrentRootPc, chordPreferSharps]);

  const guideToneDef = useMemo(() => guideToneDefinitionFromQuality(guideToneQuality), [guideToneQuality]);

  const guideToneDisplayName = useMemo(() => {
    const rootName = pcToName(chordRootPc, chordPreferSharps);
    return `${rootName}${guideToneDef.suffix}`;
  }, [chordRootPc, chordPreferSharps, guideToneDef]);

  const guideToneBadgeItems = useMemo(() => {
    return guideToneDef.intervals.map((interval, idx) => {
      const degreeRaw = guideToneDef.degreeLabels[idx] || intervalToSimpleChordDegreeToken(interval);
      return {
        note: spellNoteFromChordInterval(chordRootPc, interval, chordPreferSharps),
        degree: formatChordBadgeDegree(degreeRaw),
        role: chordBadgeRoleFromDegreeLabel(degreeRaw, interval),
      };
    });
  }, [guideToneDef, chordRootPc, chordPreferSharps]);

  const guideToneVoicings = useMemo(() => {
    const baseList = guideToneBassIntervalsForSelection(guideToneDef, guideToneInversion).flatMap((bassInterval) =>
      generateExactIntervalChordVoicings({
        rootPc: chordRootPc,
        intervals: guideToneDef.intervals,
        bassInterval,
        maxFret,
        maxSpan: chordMaxDist,
      }).map((v) => normalizeGeneratedVoicingForDisplay(v, chordRootPc, chordRootPc))
    );

    const allowedIntervals = new Set(guideToneDef.intervals.map(mod12));
    const requiredIntervals = new Set(guideToneDef.intervals.map(mod12));
    let list = dedupeAndSortVoicings(baseList);

    if (!chordAllowOpenStrings) {
      list = list.filter((v) => !voicingHasOpenStrings(v));
    }

    if (chordAllowOpenStrings) {
      list = augmentExactVoicingsWithOpenSubstitutions({
        voicings: list,
        rootPc: chordRootPc,
        allowedIntervals,
        requiredIntervals,
        allowedBassIntervals: guideToneBassIntervalsForSelection(guideToneDef, guideToneInversion),
        nearFrom: 0,
        nearTo: maxFret,
        maxFret,
        maxSpan: chordMaxDist,
        exactNoteCount: 3,
      });
    }

    list = filterVoicingsByForm(dedupeAndSortVoicings(list), guideToneForm);
    return list.slice(0, 60);
  }, [guideToneDef, guideToneInversion, chordRootPc, maxFret, chordMaxDist, chordAllowOpenStrings, guideToneForm]);

  const guideToneVoicingsSig = useMemo(() => guideToneVoicings.map((v) => v.frets).join("|"), [guideToneVoicings]);

  useEffect(() => {
    if (!guideToneVoicings.length) {
      lastGuideToneVoicingRef.current = null;
      if (guideToneVoicingIdx !== 0) setGuideToneVoicingIdx(0);
      if (guideToneSelectedFrets !== null) setGuideToneSelectedFrets(null);
      return;
    }

    const keepIdx = guideToneSelectedFrets ? guideToneVoicings.findIndex((v) => v.frets === guideToneSelectedFrets) : -1;
    if (keepIdx >= 0) {
      if (keepIdx !== guideToneVoicingIdx) {
        skipGuideToneVoicingRefSyncRef.current = true;
        setGuideToneVoicingIdx(keepIdx);
      }
      return;
    }

    const ref = lastGuideToneVoicingRef.current;
    const idx = nearestVoicingIndex(ref, guideToneVoicings);
    const nextFrets = guideToneVoicings[idx]?.frets ?? guideToneVoicings[0]?.frets ?? null;
    if (idx !== guideToneVoicingIdx) {
      skipGuideToneVoicingRefSyncRef.current = true;
      setGuideToneVoicingIdx(idx);
    }
    if (nextFrets !== guideToneSelectedFrets) setGuideToneSelectedFrets(nextFrets);
  }, [guideToneVoicingIdx, guideToneVoicingsSig, guideToneSelectedFrets]);

  useEffect(() => {
    const current = guideToneVoicings[guideToneVoicingIdx] || guideToneVoicings[0] || null;

    if (skipGuideToneVoicingRefSyncRef.current) {
      skipGuideToneVoicingRefSyncRef.current = false;
      return;
    }

    const selectedStillExists = !!guideToneSelectedFrets && guideToneVoicings.some((v) => v.frets === guideToneSelectedFrets);
    if (!selectedStillExists) {
      const nextFrets = current?.frets ?? null;
      if (nextFrets !== (guideToneSelectedFrets ?? null)) setGuideToneSelectedFrets(nextFrets);
    }

    if (current) lastGuideToneVoicingRef.current = current;
  }, [guideToneVoicingIdx, guideToneVoicings, guideToneVoicingsSig, guideToneSelectedFrets]);

  const activeGuideToneVoicing = guideToneVoicings[guideToneVoicingIdx] || guideToneVoicings[0] || null;

  const guideToneBassNote = useMemo(() => {
    if (activeGuideToneVoicing?.bassPc != null) {
      return spellNoteFromChordInterval(chordRootPc, mod12(activeGuideToneVoicing.bassPc - chordRootPc), chordPreferSharps);
    }
    const bassInterval = guideToneBassIntervalsForSelection(guideToneDef, guideToneInversion === "all" ? "root" : guideToneInversion)[0] ?? 0;
    return spellNoteFromChordInterval(chordRootPc, bassInterval, chordPreferSharps);
  }, [activeGuideToneVoicing, chordRootPc, chordPreferSharps, guideToneDef, guideToneInversion]);

  const chordIntervals = useMemo(
    () =>
      buildChordIntervals({
        quality: chordQuality,
        suspension: chordSuspension,
        structure: chordStructure,
        ext7: chordExt7,
        ext6: chordExt6,
        ext9: chordExt9,
        ext11: chordExt11,
        ext13: chordExt13,
      }),
    [chordQuality, chordSuspension, chordStructure, chordExt7, chordExt6, chordExt9, chordExt11, chordExt13]
  );

  const chordSuffix = useMemo(
    () =>
      chordSuffixFromUI({
        quality: chordQuality,
        suspension: chordSuspension,
        structure: chordStructure,
        ext7: chordExt7,
        ext6: chordExt6,
        ext9: chordExt9,
        ext11: chordExt11,
        ext13: chordExt13,
      }),
    [chordQuality, chordSuspension, chordStructure, chordExt7, chordExt6, chordExt9, chordExt11, chordExt13]
  );

  // Necesarios antes de filtrar voicings (evita TDZ)
  const chordThirdOffset = useMemo(() => chordThirdOffsetFromUI(chordQuality, chordSuspension), [chordQuality, chordSuspension]);
  const chordFifthOffset = useMemo(() => chordFifthOffsetFromUI(chordQuality, chordSuspension), [chordQuality, chordSuspension]);
  const chordEnginePlan = useMemo(
    () => buildChordEnginePlan({
      rootPc: chordRootPc,
      quality: chordQuality,
      suspension: chordSuspension,
      structure: chordStructure,
      inversion: chordInversion,
      form: chordForm,
      ext7: chordExt7,
      ext6: chordExt6,
      ext9: chordExt9,
      ext11: chordExt11,
      ext13: chordExt13,
    }),
    [chordRootPc, chordQuality, chordSuspension, chordStructure, chordInversion, chordForm, chordExt7, chordExt6, chordExt9, chordExt11, chordExt13]
  );

  const chordBassInt = useMemo(
    () =>
      chordBassInterval({
        quality: chordQuality,
        suspension: chordSuspension,
        structure: chordStructure,
        inversion: normalizeChordFormToInversion(chordInversion),
        chordIntervals,
        ext7: chordExt7,
        ext6: chordExt6,
        ext9: chordExt9,
        ext11: chordExt11,
        ext13: chordExt13,
      }),
    [chordQuality, chordSuspension, chordStructure, chordInversion, chordIntervals, chordExt7, chordExt6, chordExt9, chordExt11, chordExt13]
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

    // Para acordes tipo add6/add9/add11/add13 (sin 7ª) usamos el generador (4 notas) y evitamos ruido de JSON.
    const addOnly = isSingleAddChordSelection({
      ext7: chordExt7,
      ext6: chordExt6,
      ext9: chordExt9,
      ext11: chordExt11,
      ext13: chordExt13,
    });
    const multiAdd = isMultiAddChordSelection({
      ext7: chordExt7,
      ext6: chordExt6,
      ext9: chordExt9,
      ext11: chordExt11,
      ext13: chordExt13,
    });
    if (addOnly || multiAdd) {
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
    const urlFallbackAbs = `${PAGES_BASE}${urlRel}`;

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

      const addOnly = isSingleAddChordSelection({
        ext7: s.ext7,
        ext6: s.ext6,
        ext9: s.ext9,
        ext11: s.ext11,
        ext13: s.ext13,
      });
      const multiAdd = isMultiAddChordSelection({
        ext7: s.ext7,
        ext6: s.ext6,
        ext9: s.ext9,
        ext11: s.ext11,
        ext13: s.ext13,
      });
      if (addOnly || multiAdd) continue;

      const suffix = chordSuffixFromUI({
        quality: s.quality,
        suspension: s.suspension || "none",
        structure: s.structure,
        ext7: s.ext7,
        ext6: s.ext6,
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
          const urlFallbackAbs = `${PAGES_BASE}${it.urlRel}`;

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

  // --------------------------------------------------------------------------
  // CÁLCULOS DERIVADOS: VOICINGS DEL ACORDE PRINCIPAL
  // --------------------------------------------------------------------------

  const chordVoicings = useMemo(() => {
    const plan = chordEnginePlan;
    const inversionChoices = concreteInversionsForSelection(plan.inversion, plan.ui?.allowThirdInversion);
    const selectedBassIntervals = bassIntervalsForSelection(plan);
    const rootCandidates = symmetricRootCandidatesForPlan(plan);
    const finalizeMainVoicings = (list) => {
      const base = dedupeAndSortVoicings(list);
      if (!chordAllowOpenStrings) return base;
      const allowedIntervals = new Set((plan.intervals || []).map(mod12));
      const requiredIntervals = new Set((plan.intervals || []).map(mod12));

      if (plan.structure === "chord") {
        return augmentVoicingsWithChordToneDuplicatesInWindow({
          voicings: base,
          rootPc: plan.rootPc,
          allowedIntervals,
          requiredIntervals,
          allowedBassIntervals: selectedBassIntervals,
          nearFrom: 0,
          nearTo: maxFret,
          maxFret,
          maxSpan: chordMaxDist,
        });
      }

      const exactNoteCount = allowedIntervals.size;
      if (exactNoteCount < 3 || exactNoteCount > 4) return base;

      return augmentExactVoicingsWithOpenSubstitutions({
        voicings: base,
        rootPc: plan.rootPc,
        allowedIntervals,
        requiredIntervals,
        allowedBassIntervals: selectedBassIntervals,
        nearFrom: 0,
        nearTo: maxFret,
        maxFret,
        maxSpan: chordMaxDist,
        exactNoteCount,
      });
    };

    if (plan.generator === "triad") {
      const tri = dedupeAndSortVoicings(rootCandidates.flatMap((rootCandidate) =>
        inversionChoices.flatMap((inv) =>
          filterVoicingsByForm(generateTriadVoicings({
            rootPc: rootCandidate,
            thirdOffset: plan.thirdOffset,
            fifthOffset: plan.fifthOffset,
            inversion: inv,
            maxFret,
            maxSpan: chordMaxDist,
          }), plan.form).map((v) => normalizeGeneratedVoicingForDisplay(v, plan.rootPc, rootCandidate))
        )
      ));
      const finalTri = finalizeMainVoicings(tri);
      return finalTri.slice(0, 60);
    }

    if (plan.generator === "drop") {
      if (plan.topVoiceOffset == null) return [];
      const tet = dedupeAndSortVoicings(rootCandidates.flatMap((rootCandidate) =>
        inversionChoices.flatMap((inv) =>
          generateDropTetradVoicings({
            rootPc: rootCandidate,
            thirdOffset: plan.thirdOffset,
            fifthOffset: plan.fifthOffset,
            seventhOffset: plan.topVoiceOffset,
            form: plan.form,
            inversion: inv,
            maxFret,
            maxSpan: chordMaxDist,
          }).map((v) => normalizeGeneratedVoicingForDisplay(v, plan.rootPc, rootCandidate))
        )
      ));
      const finalTet = finalizeMainVoicings(tet);
      return finalTet.slice(0, 60);
    }

    if (plan.generator === "tetrad") {
      const tet = plan.form === "open"
        ? buildOpenSupersetTetradVoicings({
            rootCandidates,
            inversionChoices,
            plan,
            maxFret,
            maxSpan: chordMaxDist,
          })
        : (() => {
            const topVoiceOffset = plan.topVoiceOffset;
            if (topVoiceOffset == null) return [];
            return dedupeAndSortVoicings(rootCandidates.flatMap((rootCandidate) =>
              inversionChoices.flatMap((inv) =>
                filterVoicingsByForm(generateTetradVoicings({
                  rootPc: rootCandidate,
                  thirdOffset: plan.thirdOffset,
                  fifthOffset: plan.fifthOffset,
                  seventhOffset: topVoiceOffset,
                  inversion: inv,
                  maxFret,
                  maxSpan: chordMaxDist,
                }), plan.form).map((v) => normalizeGeneratedVoicingForDisplay(v, plan.rootPc, rootCandidate))
              )
            ));
          })();
      const finalTet = finalizeMainVoicings(tet);
      return finalTet.slice(0, 60);
    }

    if (plan.generator === "exact") {
      const multi = dedupeAndSortVoicings(selectedBassIntervals.flatMap((bassInterval) => generateExactIntervalChordVoicings({
        rootPc: plan.rootPc,
        intervals: plan.intervals,
        bassInterval,
        maxFret,
        maxSpan: chordMaxDist,
      }).map((v) => normalizeGeneratedVoicingForDisplay(v, plan.rootPc, plan.rootPc))));
      const finalMulti = finalizeMainVoicings(multi);
      return finalMulti.slice(0, 60);
    }

    if (plan.generator === "json") {
      if (!chordDb?.positions?.length) return [];

      const allowed = new Set(plan.intervals.map(mod12));
      const required = new Set([mod12(plan.thirdOffset)]);
      const noTensions = !plan.ext7 && !plan.ext6 && !plan.ext9 && !plan.ext11 && !plan.ext13;

      if (noTensions) {
        required.add(0);
        required.add(mod12(plan.fifthOffset));
      } else {
        if (plan.ext7 && plan.seventhOffset != null) required.add(mod12(plan.seventhOffset));
        if (plan.ext6) required.add(9);
        if (plan.ext9) required.add(2);
        if (plan.ext11) required.add(5);
        if (plan.ext13) required.add(9);
      }

      const outStrict = [];
      const outLoose = [];
      const seen = new Set();

      for (const p of chordDb.positions || []) {
        const fretsLH = parseChordDbFretsString(p?.frets);
        if (!fretsLH) continue;
        const v = buildVoicingFromFretsLH({ fretsLH, rootPc: plan.rootPc, maxFret });
        if (!v || !isErgonomicVoicing(v, chordMaxDist)) continue;

        const extraOk = new Set([2, 5, 9, 10, 11]);
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

        const bi = mod12(v.bassPc - plan.rootPc);
        const key = `${v.frets}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const item = { ...v, _extra: extraCount };
        if (selectedBassIntervals.includes(bi)) outStrict.push(item);
        else if (plan.inversion !== "all") outLoose.push(item);
      }

      const list = outStrict.length ? outStrict : outLoose;
      list.sort((a, b) => ((a._extra ?? 0) - (b._extra ?? 0)) || (a.minFret - b.minFret) || (a.span - b.span) || (a.maxFret - b.maxFret));
      const finalJson = finalizeMainVoicings(list);
      return finalJson.slice(0, 60);
    }

    return [];
  }, [chordEnginePlan, chordDb, chordMaxDist, chordAllowOpenStrings, maxFret]);

  const chordVoicingsSig = useMemo(() => chordVoicings.map((v) => v.frets).join("|"), [chordVoicings]);

  useEffect(() => {
    if (!storageHydrated) return;
    if (!chordVoicings.length) {
      if (!pendingChordRestoreRef.current.active && chordVoicingIdx !== 0) setChordVoicingIdx(0);
      return;
    }

    if (pendingChordRestoreRef.current.active) {
      const wanted = pendingChordRestoreRef.current.frets;
      if (wanted == null) {
        pendingChordRestoreRef.current = { active: false, frets: null };
      } else {
        const restoredIdx = chordVoicings.findIndex((v) => v.frets === wanted);
        if (restoredIdx >= 0) {
          if (restoredIdx !== chordVoicingIdx) {
            skipChordVoicingRefSyncRef.current = true;
            setChordVoicingIdx(restoredIdx);
          }
          if (chordSelectedFrets !== wanted) setChordSelectedFrets(wanted);
          pendingChordRestoreRef.current = { active: false, frets: null };
          return;
        }
        return;
      }
    }

    const keepIdx = chordSelectedFrets ? chordVoicings.findIndex((v) => v.frets === chordSelectedFrets) : -1;
    if (keepIdx >= 0) {
      if (keepIdx !== chordVoicingIdx) {
        skipChordVoicingRefSyncRef.current = true;
        setChordVoicingIdx(keepIdx);
      }
      return;
    }

    const ref = lastChordVoicingRef.current;
    const idx = nearestVoicingIndex(ref, chordVoicings);
    const nextFrets = chordVoicings[idx]?.frets ?? null;
    if (idx !== chordVoicingIdx) {
      skipChordVoicingRefSyncRef.current = true;
      setChordVoicingIdx(idx);
    }
    if (nextFrets !== chordSelectedFrets) setChordSelectedFrets(nextFrets);
  }, [storageHydrated, chordVoicingsSig, chordSelectedFrets]);

  useEffect(() => {
    if (!storageHydrated) return;
    const current = chordVoicings[chordVoicingIdx] || chordVoicings[0] || null;
    const selectedStillExists = !!chordSelectedFrets && chordVoicings.some((v) => v.frets === chordSelectedFrets);

    if (!pendingChordRestoreRef.current.active && !selectedStillExists) {
      const nextFrets = current?.frets ?? null;
      if (nextFrets !== (chordSelectedFrets ?? null)) setChordSelectedFrets(nextFrets);
    }

    if (skipChordVoicingRefSyncRef.current) {
      skipChordVoicingRefSyncRef.current = false;
      return;
    }
    if (current) lastChordVoicingRef.current = current;
  }, [storageHydrated, chordVoicingIdx, chordVoicingsSig, chordSelectedFrets]);

  const activeChordVoicing = chordVoicings[chordVoicingIdx] || chordVoicings[0] || null;

  // --------------------------------------------------------------------------
  // CÁLCULOS DERIVADOS: DETECCIÓN DE ACORDES EN MÁSTIL
  // --------------------------------------------------------------------------

  const chordDetectSelectedNotes = useMemo(() => {
    return chordDetectSelectedKeys
      .map((key) => {
        const [sStr, fStr] = String(key || "").split(":");
        const sIdx = parseInt(sStr, 10);
        const fret = parseInt(fStr, 10);
        if (!Number.isFinite(sIdx) || !Number.isFinite(fret)) return null;
        return {
          key,
          sIdx,
          fret,
          pc: mod12(STRINGS[sIdx].pc + fret),
          pitch: pitchAt(sIdx, fret),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.pitch - b.pitch);
  }, [chordDetectSelectedKeys]);

  const chordDetectCandidates = useMemo(
    () => analyzeDetectedChordCandidates(chordDetectSelectedNotes),
    [chordDetectSelectedNotes]
  );

  const chordDetectSelectionSignature = useMemo(
    () => [...chordDetectSelectedKeys].sort().join("|"),
    [chordDetectSelectedKeys]
  );

  const chordDetectSelectedCandidate = useMemo(
    () => chordDetectCandidates.find((c) => c.id === chordDetectCandidateId) || null,
    [chordDetectCandidates, chordDetectCandidateId]
  );

  useEffect(() => {
    if (!chordDetectMode) return;
    if (!chordDetectCandidates.length) {
      if (chordDetectCandidateId !== null) setChordDetectCandidateId(null);
      return;
    }
    if (chordDetectCandidateId && !chordDetectCandidates.some((c) => c.id === chordDetectCandidateId)) {
      setChordDetectCandidateId(null);
    }
  }, [chordDetectMode, chordDetectCandidates, chordDetectCandidateId]);

  useEffect(() => {
    if (!chordDetectMode) return;
    const nextId = chordDetectCandidates[0]?.id || null;
    if ((chordDetectCandidateId || null) !== nextId) {
      setChordDetectCandidateId(nextId);
    }
  }, [chordDetectMode, chordDetectSelectionSignature, chordDetectCandidates]);

  // --------------------------------------------------------------------------
  // HELPERS LOCALES: DETECCIÓN DE ACORDES (audio y selección)
  // --------------------------------------------------------------------------

  function fnMidiToFreq(vMidi) {
    return 440 * Math.pow(2, (Number(vMidi) - 69) / 12);
  }

  async function fnGetChordDetectAudioCtx() {
    if (typeof window === "undefined") return null;
    const vAudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!vAudioCtor) return null;

    let vCtx = chordDetectAudioCtxRef.current;
    if (!vCtx) {
      vCtx = new vAudioCtor();
      chordDetectAudioCtxRef.current = vCtx;
    }

    if (vCtx.state === "suspended") {
      try {
        await vCtx.resume();
      } catch {
      }
    }

    return vCtx;
  }

  function fnScheduleChordDetectMidi(vCtx, vMidi, vStartTime, vDuration = 1.2) {
    const vOsc = vCtx.createOscillator();
    const vGain = vCtx.createGain();

    vOsc.type = "triangle";
    vOsc.frequency.setValueAtTime(fnMidiToFreq(vMidi), vStartTime);

    vGain.gain.setValueAtTime(0.0001, vStartTime);
    vGain.gain.exponentialRampToValueAtTime(0.16, vStartTime + 0.02);
    vGain.gain.exponentialRampToValueAtTime(0.08, vStartTime + 0.18);
    vGain.gain.exponentialRampToValueAtTime(0.045, vStartTime + 0.6);
    vGain.gain.exponentialRampToValueAtTime(0.0001, vStartTime + Math.max(0.75, vDuration - 0.05));

    vOsc.connect(vGain);
    vGain.connect(vCtx.destination);

    vOsc.start(vStartTime);
    vOsc.stop(vStartTime + vDuration);
    vOsc.onended = () => {
      try { vOsc.disconnect(); } catch {}
      try { vGain.disconnect(); } catch {}
    };
  }

  async function fnPlayChordDetectNote(sIdx, fret) {
    const vCtx = await fnGetChordDetectAudioCtx();
    if (!vCtx) return;
    fnScheduleChordDetectMidi(vCtx, pitchAt(sIdx, fret), vCtx.currentTime, 1.2);
  }

  async function fnPlayChordDetectSelection() {
    if (!chordDetectSelectedNotes.length) return;
    const vCtx = await fnGetChordDetectAudioCtx();
    if (!vCtx) return;

    const vNotes = [...chordDetectSelectedNotes].sort((a, b) => a.pitch - b.pitch);
    const vStep = 0.26;
    const vNow = vCtx.currentTime;

    vNotes.forEach((vNote, vIdx) => {
      fnScheduleChordDetectMidi(vCtx, vNote.pitch, vNow + (vIdx * vStep), 0.85);
    });
  }

  useEffect(() => {
    return () => {
      const vCtx = chordDetectAudioCtxRef.current;
      if (vCtx && typeof vCtx.close === "function") {
        vCtx.close().catch(() => {});
      }
      chordDetectAudioCtxRef.current = null;
    };
  }, []);

  function selectDetectedCandidate(candidate) {
    setChordDetectCandidateId(candidate?.id || null);
  }

  function applyDetectedCandidate(candidate) {
    if (!candidate) return;
    setChordDetectCandidateId(candidate.id);
    if (!candidate.uiPatch) return;
    setStudyTarget("main");

    const p = candidate.uiPatch;

    if (p.family === "quartal") {
      setChordFamily("quartal");
      setChordRootPc(p.rootPc);
      setChordSpellPreferSharps(!!p.spellPreferSharps);
      setChordQuartalType(p.quartalType || "pure");
      setChordQuartalVoices(p.quartalVoices || "4");
      setChordQuartalSpread(p.quartalSpread || "closed");
      setChordQuartalReference(p.quartalReference || "root");
      setChordQuartalSelectedFrets(null);
      setChordQuartalVoicingIdx(0);
      return;
    }

    setChordFamily("tertian");
    setChordRootPc(p.rootPc);
    setChordSpellPreferSharps(!!p.spellPreferSharps);
    setChordQuality(p.quality);
    setChordSuspension(p.suspension || "none");
    setChordStructure(p.structure);
    setChordInversion(p.inversion || "root");
    setChordPositionForm(p.positionForm || "open");
    setChordForm(p.form || p.positionForm || "open");
    setChordExt7(!!p.ext7);
    setChordExt6(!!p.ext6);
    setChordExt9(!!p.ext9);
    setChordExt11(!!p.ext11);
    setChordExt13(!!p.ext13);
    setChordSelectedFrets(null);
    setChordVoicingIdx(0);
  }

  function toggleChordDetectCell(sIdx, fret) {
    if (chordDetectClickAudio) fnPlayChordDetectNote(sIdx, fret);
    const key = `${sIdx}:${fret}`;
    setChordDetectSelectedKeys((prev) => {
      if (prev.includes(key)) return prev.filter((x) => x !== key);
      const withoutSameString = prev.filter((x) => !String(x).startsWith(`${sIdx}:`));
      return [...withoutSameString, key];
    });
  }

  const chordDetectSelectedNotesText = useMemo(
    () => chordDetectSelectedNotes
      .map((n) => buildDetectedCandidateNoteNameForPc(n.pc, chordDetectSelectedCandidate, chordPreferSharps))
      .join(", "),
    [chordDetectSelectedNotes, chordDetectSelectedCandidate, chordPreferSharps]
  );

  const chordDetectStaffEvents = useMemo(
    () => chordDetectSelectedNotes.length
      ? [{ notes: [...chordDetectSelectedNotes].sort((a, b) => a.pitch - b.pitch).map((n) => n.pitch) }]
      : [],
    [chordDetectSelectedNotes]
  );

  const chordDetectSelectionPositionsText = useMemo(
    () => chordDetectSelectedNotes.length
      ? [...chordDetectSelectedNotes]
          .sort((a, b) => a.pitch - b.pitch)
          .map((n) => `${n.sIdx + 1}ª/${n.fret}`)
          .join(" · ")
      : "",
    [chordDetectSelectedNotes]
  );

  const chordDetectSelectedCandidateNotesText = useMemo(() => {
    if (!chordDetectSelectedCandidate) return "";
    const coreNotes = Array.isArray(chordDetectSelectedCandidate.visibleNotes)
      ? chordDetectSelectedCandidate.visibleNotes.filter(Boolean)
      : [];
    const noteText = Array.from(new Set(coreNotes)).join(", ");
    if (chordDetectSelectedCandidate.externalBassInterval == null) return noteText;

    const bassName = spellNoteFromChordInterval(
      chordDetectSelectedCandidate.rootPc,
      chordDetectSelectedCandidate.externalBassInterval,
      chordDetectSelectedCandidate.preferSharps ?? chordPreferSharps
    );

    return noteText ? `${noteText} · bajo en ${bassName}` : `bajo en ${bassName}`;
  }, [chordDetectSelectedCandidate, chordPreferSharps]);

  const chordDetectSelectedCandidateScaleNotesText = useMemo(() => {
    if (!chordDetectSelectedCandidate) return "";
    return spellScaleNotes({
      rootPc: chordDetectSelectedCandidate.rootPc,
      scaleIntervals,
      preferSharps: chordDetectSelectedCandidate.preferSharps ?? chordPreferSharps,
    }).join(", ");
  }, [chordDetectSelectedCandidate, scaleIntervals, chordPreferSharps]);

  const chordDetectSelectedCandidateBadgeItems = useMemo(() => {
    if (!chordDetectSelectedCandidate) return [];
    const prefer = chordDetectSelectedCandidate.preferSharps ?? chordPreferSharps;

    const entries = [];

    if (Array.isArray(chordDetectSelectedCandidate.formula?.intervals)) {
      chordDetectSelectedCandidate.formula.intervals.forEach((intv, idx) => {
        const interval = mod12(intv);
        if (!chordDetectSelectedCandidate.visibleIntervals.includes(interval)) return;
        const degreeRaw = String(chordDetectSelectedCandidate.formula.degreeLabels?.[idx] || "");
        entries.push({
          interval,
          item: {
            note: spellNoteFromChordInterval(chordDetectSelectedCandidate.rootPc, interval, prefer),
            degree: formatChordBadgeDegree(degreeRaw || intervalToSimpleChordDegreeToken(interval)),
            role: chordBadgeRoleFromDegreeLabel(degreeRaw || intervalToSimpleChordDegreeToken(interval), interval),
          },
        });
      });
    }

    if (chordDetectSelectedCandidate.externalBassInterval != null) {
      const interval = mod12(chordDetectSelectedCandidate.externalBassInterval);
      const degreeRaw = intervalToSimpleChordDegreeToken(interval);
      entries.push({
        interval,
        item: {
          note: spellNoteFromChordInterval(chordDetectSelectedCandidate.rootPc, interval, prefer),
          degree: formatChordBadgeDegree(degreeRaw),
          role: chordBadgeRoleFromDegreeLabel(degreeRaw, interval),
        },
      });
    }

    entries.sort((a, b) => a.interval - b.interval);
    return entries.map((x) => x.item);
  }, [chordDetectSelectedCandidate, chordPreferSharps]);

  const chordDetectSelectedCandidateBassNote = useMemo(() => {
    if (!chordDetectSelectedCandidate) return null;
    const prefer = chordDetectSelectedCandidate.preferSharps ?? chordPreferSharps;
    const bassInterval = chordDetectSelectedCandidate.externalBassInterval != null
      ? chordDetectSelectedCandidate.externalBassInterval
      : mod12(chordDetectSelectedCandidate.bassPc - chordDetectSelectedCandidate.rootPc);

    return spellNoteFromChordInterval(chordDetectSelectedCandidate.rootPc, bassInterval, prefer);
  }, [chordDetectSelectedCandidate, chordPreferSharps]);

  const chordBaseDisplayName = chordDisplayNameFromUI({
        rootPc: chordRootPc,
        preferSharps: chordPreferSharps,
        quality: chordQuality,
        suspension: chordSuspension,
        structure: chordStructure,
        ext7: chordExt7,
        ext6: chordExt6,
        ext9: chordExt9,
        ext11: chordExt11,
        ext13: chordExt13,
      });

  const chordSectionDisplayName = buildChordHeaderSummary({
    name: chordBaseDisplayName,
    plan: chordEnginePlan,
    voicing: activeChordVoicing,
    positionForm: chordPositionForm,
  });

  const guideToneSectionDisplayName = useMemo(() => {
    const inversionLabel = CHORD_GUIDE_TONE_INVERSIONS.find((x) => x.value === guideToneInversion)?.label || "Todas";
    const formLabel = CHORD_GUIDE_TONE_FORMS.find((x) => x.value === guideToneForm)?.label || "Cerrado";
    return `${guideToneDisplayName} · Notas guía · ${formLabel} · ${inversionLabel}`;
  }, [guideToneDisplayName, guideToneForm, guideToneInversion]);

  const chordHeaderBadgeItems = useMemo(
    () => buildChordBadgeItems({
      notes: spellChordNotes({ rootPc: chordRootPc, chordIntervals, preferSharps: chordPreferSharps }),
      intervals: chordIntervals,
      ext6: chordExt6,
      ext9: chordExt9,
      ext11: chordExt11,
      ext13: chordExt13,
      structure: chordStructure,
    }),
    [chordRootPc, chordIntervals, chordPreferSharps, chordExt6, chordExt9, chordExt11, chordExt13, chordStructure]
  );

  const chordHeaderBassNote = useMemo(() => {
    const bassPc = activeChordVoicing?.bassPc ?? chordBassPc;
    return chordPcToSpelledName(bassPc);
  }, [activeChordVoicing, chordBassPc, chordPcToSpelledName]);

  const nearFrom = useMemo(
    () => Math.max(0, Math.min(maxFret, Math.floor(Number(nearWindowStart) || 0))),
    [nearWindowStart, maxFret]
  );

  const nearTo = useMemo(() => {
    const size = Math.max(1, Math.floor(Number(nearWindowSize) || 1));
    return Math.max(nearFrom, Math.min(maxFret, nearFrom + size - 1));
  }, [nearFrom, nearWindowSize, maxFret]);

  const nearStartMax = useMemo(
    () => Math.max(0, maxFret - (Math.max(1, Math.floor(Number(nearWindowSize) || 1)) - 1)),
    [nearWindowSize, maxFret]
  );

  function updateNearSlot(idx, patch) {
    setNearSlots((prev) => prev.map((slot, i) => {
      if (i !== idx) return slot;
      const next = { ...slot, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch || {}, "form") && !isDropForm(next.form)) {
        next.positionForm = next.form;
      }
      return next;
    }));
  }

  function spellChordNotesForSlot(slot) {
    const ints = buildChordIntervals({
      quality: slot?.quality,
      suspension: slot?.suspension || "none",
      structure: slot?.structure,
      ext7: !!slot?.ext7,
      ext6: !!slot?.ext6,
      ext9: !!slot?.ext9,
      ext11: !!slot?.ext11,
      ext13: !!slot?.ext13,
    });
    const pref = slot?.spellPreferSharps ?? preferSharpsFromMajorTonicPc(mod12(slot?.rootPc || 0));
    return spellChordNotes({ rootPc: slot?.rootPc || 0, chordIntervals: ints, preferSharps: pref });
  }

  function nearestVoicingIndex(reference, options) {
    const list = Array.isArray(options) ? options : [];
    if (!list.length) return 0;
    if (!reference) return 0;

    const refFrets = parseChordDbFretsString(reference?.frets);
    const refCenter = ((reference?.minFret ?? 0) + (reference?.maxFret ?? 0)) / 2;
    const refBassPitch = reference?.notes?.length
      ? Math.min(...reference.notes.map((n) => pitchAt(n.sIdx, n.fret)))
      : 0;

    let bestIdx = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    list.forEach((v, idx) => {
      const vFrets = parseChordDbFretsString(v?.frets);
      const vCenter = ((v?.minFret ?? 0) + (v?.maxFret ?? 0)) / 2;
      const vBassPitch = v?.notes?.length
        ? Math.min(...v.notes.map((n) => pitchAt(n.sIdx, n.fret)))
        : 0;

      let overlap = 0;
      if (refFrets && vFrets) {
        for (let i = 0; i < 6; i++) {
          if (refFrets[i] === vFrets[i]) overlap += 1;
        }
      }

      const score =
        Math.abs(vCenter - refCenter) * 3 +
        Math.abs(vBassPitch - refBassPitch) * 0.2 +
        Math.abs((v?.reach ?? ((v?.span ?? 0) + 1)) - (reference?.reach ?? ((reference?.span ?? 0) + 1))) * 1.2 -
        overlap * 4;

      if (score < bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    return bestIdx;
  }

  const nearComputed = useMemo(() => {
    const baseIdx = nearSlots.findIndex((slot) => !!slot?.enabled);

    const rankVsBase = (candidate, baseVoicing) => {
      if (!candidate || !baseVoicing) return 0;

      const cCenter = ((candidate.minFret ?? 0) + (candidate.maxFret ?? 0)) / 2;
      const bCenter = ((baseVoicing.minFret ?? 0) + (baseVoicing.maxFret ?? 0)) / 2;
      const cBassPitch = candidate.notes?.length
        ? Math.min(...candidate.notes.map((n) => pitchAt(n.sIdx, n.fret)))
        : 0;
      const bBassPitch = baseVoicing.notes?.length
        ? Math.min(...baseVoicing.notes.map((n) => pitchAt(n.sIdx, n.fret)))
        : 0;
      const overlap = (candidate.notes || []).filter((n) =>
        (baseVoicing.notes || []).some((b) => b.sIdx === n.sIdx && b.fret === n.fret)
      ).length;

      return (
        Math.abs(cCenter - bCenter) * 3 +
        Math.abs(cBassPitch - bBassPitch) * 0.18 +
        Math.abs((candidate.reach ?? ((candidate.span ?? 0) + 1)) - (baseVoicing.reach ?? ((baseVoicing.span ?? 0) + 1))) * 1.1 -
        overlap * 5
      );
    };

    const buildSlotVoicings = (slot) => {
      if (!slot?.enabled) return { plan: null, ranked: [], err: null };

      const plan = buildChordEnginePlan({
        rootPc: slot.rootPc,
        quality: slot.quality,
        suspension: slot.suspension || "none",
        structure: slot.structure,
        inversion: slot.inversion,
        form: slot.form,
        ext7: !!slot.ext7,
        ext6: !!slot.ext6,
        ext9: !!slot.ext9,
        ext11: !!slot.ext11,
        ext13: !!slot.ext13,
      });

      const maxSpan = slot.maxDist || 4;
      const allowOpenStrings = !!slot.allowOpenStrings;
      const selectedBassIntervals = bassIntervalsForSelection(plan);
      const rootCandidates = symmetricRootCandidatesForPlan(plan);

      const inNearWindow = (fret) => fret >= nearFrom && fret <= nearTo;
      const voicingFits = (v) => {
        if (!v || !isErgonomicVoicing(v, maxSpan)) return false;
        return (v.notes || []).every((n) => (n.fret === 0 ? allowOpenStrings : inNearWindow(n.fret)));
      };

      const dedupeWindowed = (list) => dedupeAndSortVoicings(list).filter(voicingFits);

      const finalize = (list) => {
        let base = dedupeWindowed(list);
        if (!allowOpenStrings) return base;

        const allowedIntervals = new Set((plan.intervals || []).map(mod12));
        const requiredIntervals = new Set((plan.intervals || []).map(mod12));

        if (plan.structure === "chord") {
          base = augmentVoicingsWithChordToneDuplicatesInWindow({
            voicings: base,
            rootPc: plan.rootPc,
            allowedIntervals,
            requiredIntervals,
            allowedBassIntervals: selectedBassIntervals,
            nearFrom,
            nearTo,
            maxFret,
            maxSpan,
          });
          return dedupeWindowed(base);
        }

        const exactNoteCount = allowedIntervals.size;
        if (exactNoteCount < 3 || exactNoteCount > 4) return base;

        base = augmentExactVoicingsWithOpenSubstitutions({
          voicings: base,
          rootPc: plan.rootPc,
          allowedIntervals,
          requiredIntervals,
          allowedBassIntervals: selectedBassIntervals,
          nearFrom,
          nearTo,
          maxFret,
          maxSpan,
          exactNoteCount,
        });
        return dedupeWindowed(base);
      };

      if (plan.generator === "triad") {
        const list = rootCandidates.flatMap((rootCandidate) =>
          concreteInversionsForSelection(plan.inversion, plan.ui?.allowThirdInversion).flatMap((inv) =>
            filterVoicingsByForm(
              generateTriadVoicings({
                rootPc: rootCandidate,
                thirdOffset: plan.thirdOffset,
                fifthOffset: plan.fifthOffset,
                inversion: inv,
                maxFret,
                maxSpan,
              }),
              plan.form
            ).map((v) => normalizeGeneratedVoicingForDisplay(v, plan.rootPc, rootCandidate))
          )
        );
        return { plan, ranked: finalize(list), err: null };
      }

      if (plan.generator === "drop") {
        if (plan.topVoiceOffset == null) return { plan, ranked: [], err: "Sin voicings en este rango." };
        const list = rootCandidates.flatMap((rootCandidate) =>
          concreteInversionsForSelection(plan.inversion, plan.ui?.allowThirdInversion).flatMap((inv) =>
            generateDropTetradVoicings({
              rootPc: rootCandidate,
              thirdOffset: plan.thirdOffset,
              fifthOffset: plan.fifthOffset,
              seventhOffset: plan.topVoiceOffset,
              form: plan.form,
              inversion: inv,
              maxFret,
              maxSpan,
            }).map((v) => normalizeGeneratedVoicingForDisplay(v, plan.rootPc, rootCandidate))
          )
        );
        return { plan, ranked: finalize(list), err: null };
      }

      if (plan.generator === "tetrad") {
        const list = plan.form === "open"
          ? buildOpenSupersetTetradVoicings({
              rootCandidates,
              inversionChoices: concreteInversionsForSelection(plan.inversion, plan.ui?.allowThirdInversion),
              plan,
              maxFret,
              maxSpan,
            })
          : rootCandidates.flatMap((rootCandidate) =>
              concreteInversionsForSelection(plan.inversion, plan.ui?.allowThirdInversion).flatMap((inv) =>
                filterVoicingsByForm(
                  generateTetradVoicings({
                    rootPc: rootCandidate,
                    thirdOffset: plan.thirdOffset,
                    fifthOffset: plan.fifthOffset,
                    seventhOffset: plan.topVoiceOffset,
                    inversion: inv,
                    maxFret,
                    maxSpan,
                  }),
                  plan.form
                ).map((v) => normalizeGeneratedVoicingForDisplay(v, plan.rootPc, rootCandidate))
              )
            );
        return { plan, ranked: finalize(list), err: null };
      }

      if (plan.generator === "exact") {
        const list = selectedBassIntervals.flatMap((bassInterval) =>
          generateExactIntervalChordVoicings({
            rootPc: plan.rootPc,
            intervals: plan.intervals,
            bassInterval,
            maxFret,
            maxSpan,
          }).map((v) => normalizeGeneratedVoicingForDisplay(v, plan.rootPc, plan.rootPc))
        );
        return { plan, ranked: finalize(list), err: null };
      }

      if (plan.generator === "json") {
        const suffix = chordSuffixFromUI({
          quality: slot.quality,
          suspension: slot.suspension || "none",
          structure: slot.structure,
          ext7: !!slot.ext7,
          ext6: !!slot.ext6,
          ext9: !!slot.ext9,
          ext11: !!slot.ext11,
          ext13: !!slot.ext13,
        });
        const cacheKey = `${chordDbKeyNameFromPc(slot.rootPc)}/${suffix}`;
        const json = chordDbCache[cacheKey];
        const cachedErr = chordDbCacheErr[cacheKey] || null;

        if (!json?.positions?.length) {
          return { plan, ranked: [], err: cachedErr || "Sin digitaciones en este rango." };
        }

        const allowed = new Set(plan.intervals.map(mod12));
        const required = new Set([mod12(plan.thirdOffset)]);
        const noTensions = !slot.ext7 && !slot.ext6 && !slot.ext9 && !slot.ext11 && !slot.ext13;

        if (noTensions) {
          required.add(0);
          required.add(mod12(plan.fifthOffset));
        } else {
          if (slot.ext7 && plan.seventhOffset != null) required.add(mod12(plan.seventhOffset));
          if (slot.ext6) required.add(9);
          if (slot.ext9) required.add(2);
          if (slot.ext11) required.add(5);
          if (slot.ext13) required.add(9);
        }

        const strict = [];
        const loose = [];
        const seen = new Set();

        for (const p of json.positions || []) {
          const fretsLH = parseChordDbFretsString(p?.frets);
          if (!fretsLH) continue;
          const v = buildVoicingFromFretsLH({ fretsLH, rootPc: plan.rootPc, maxFret });
          if (!voicingFits(v)) continue;

          const extraOk = new Set([2, 5, 9, 10, 11]);
          let invalid = false;
          let extraCount = 0;

          for (const r of v.relIntervals) {
            if (!allowed.has(r)) {
              if (extraOk.has(r)) extraCount += 1;
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

          const bassInt = mod12(v.bassPc - plan.rootPc);
          const key = `${v.frets}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const item = { ...v, _extra: extraCount };
          if (selectedBassIntervals.includes(bassInt)) strict.push(item);
          else if (plan.inversion !== "all") loose.push(item);
        }

        const list = strict.length ? strict : loose;
        list.sort((a, b) => ((a._extra ?? 0) - (b._extra ?? 0)) || (a.minFret - b.minFret) || (a.span - b.span) || (a.maxFret - b.maxFret));
        return { plan, ranked: finalize(list), err: null };
      }

      return { plan, ranked: [], err: "Sin voicings en este rango." };
    };

    const initial = nearSlots.map((slot) => buildSlotVoicings(slot));
    const baseOptions = baseIdx >= 0 ? (initial[baseIdx]?.ranked || []) : [];
    const baseRef = baseIdx >= 0
      ? (baseOptions.find((v) => v.frets === nearSlots[baseIdx]?.selFrets) || baseOptions[0] || null)
      : null;

    const ranked = initial.map((entry, idx) => {
      if (idx === baseIdx || !baseRef || !(entry?.ranked?.length)) return entry;
      return {
        ...entry,
        ranked: [...entry.ranked].sort((a, b) => {
          const da = rankVsBase(a, baseRef);
          const db = rankVsBase(b, baseRef);
          if (da !== db) return da - db;
          return (a.minFret - b.minFret) || ((a.reach ?? (a.span + 1)) - (b.reach ?? (b.span + 1))) || a.frets.localeCompare(b.frets);
        }),
      };
    });

    const selected = ranked.map((entry, idx) => {
      if (!nearSlots[idx]?.enabled) return null;
      const options = entry?.ranked || [];
      if (!options.length) return null;
      return options.find((v) => v.frets === nearSlots[idx]?.selFrets) || options[0] || null;
    });

    return { baseIdx, ranked, selected };
  }, [nearSlots, nearFrom, nearTo, maxFret, chordDbCache, chordDbCacheErr]);

  const nearRankSig = useMemo(
    () => nearComputed.ranked.map((entry) => (entry?.ranked || []).map((v) => v.frets).join(",")).join("|"),
    [nearComputed.ranked]
  );

  const nearSelectedSig = useMemo(
    () => nearComputed.selected.map((v) => v?.frets || "").join("|"),
    [nearComputed.selected]
  );

  const studyData = useMemo(() => {
    if (studyTarget === "main") {
      const detectCandidate = chordDetectMode ? chordDetectSelectedCandidate : null;
      if (detectCandidate) {
        const mainRootPc = detectCandidate.rootPc;
        const mainPreferSharps = detectCandidate.preferSharps ?? chordPreferSharps;
        const mainIntervals = detectCandidate.formula?.intervals?.length
          ? detectCandidate.formula.intervals.map(mod12)
          : chordIntervals;
        const mainDegreeLabels = detectCandidate.formula?.degreeLabels?.length === mainIntervals.length
          ? detectCandidate.formula.degreeLabels
          : null;
        const mainSpelledNotes = spellChordNotes({ rootPc: mainRootPc, chordIntervals: mainIntervals, preferSharps: mainPreferSharps });
        const mainPcToSpelledName = (pc) => {
          const interval = mod12(pc - mainRootPc);
          const idx = mainIntervals.findIndex((x) => mod12(x) === interval);
          return idx >= 0 ? mainSpelledNotes[idx] : pcToName(pc, mainPreferSharps);
        };
        const manualStudyVoicing = buildManualSelectionVoicing(chordDetectSelectedNotes, mainRootPc, maxFret);
        const currentMainVoicing = manualStudyVoicing || activeChordVoicing;

        return {
          rootPc: mainRootPc,
          preferSharps: mainPreferSharps,
          title: "Acorde principal",
          chordName: detectCandidate.name,
          notes: mainSpelledNotes,
          intervals: mainDegreeLabels || mainIntervals.map((i) => intervalToChordToken(i, { ext6: chordExt6, ext9: chordExt9 && chordStructure !== "triad", ext11: chordExt11 && chordStructure !== "triad", ext13: chordExt13 && chordStructure !== "triad" })),
          plan: chordEnginePlan,
          voicing: currentMainVoicing,
          bassName: currentMainVoicing ? mainPcToSpelledName(currentMainVoicing.bassPc) : pcToName(chordBassPc, mainPreferSharps),
          inversionLabel: currentMainVoicing
            ? actualInversionLabelFromVoicing(chordEnginePlan, currentMainVoicing)
            : CHORD_INVERSIONS.find((x) => x.value === chordInversion)?.label || "Fundamental",
        };
      }

      if (chordFamily === "quartal") {
        const quartalOrderedPcs = Array.isArray(activeQuartalVoicing?.quartalOrderedPcs) && activeQuartalVoicing.quartalOrderedPcs.length
          ? activeQuartalVoicing.quartalOrderedPcs
          : (Array.isArray(chordQuartalPitchSets?.[0]?.pcs) ? chordQuartalPitchSets[0].pcs : []);
        const quartalRootPc = chordQuartalCurrentRootPc;
        const quartalIntervals = quartalOrderedPcs.map((pc) => mod12(pc - quartalRootPc));
        const quartalNotes = quartalIntervals.map((interval) => spellNoteFromChordInterval(quartalRootPc, interval, chordPreferSharps));
        const quartalVoicing = activeQuartalVoicing
          ? {
              ...activeQuartalVoicing,
              relIntervals: new Set((activeQuartalVoicing.notes || []).map((n) => mod12(n.pc - quartalRootPc))),
            }
          : null;
        const quartalPlan = {
          rootPc: quartalRootPc,
          intervals: quartalIntervals,
          bassInterval: quartalVoicing?.bassPc != null ? mod12(quartalVoicing.bassPc - quartalRootPc) : (quartalIntervals[0] ?? 0),
          thirdOffset: quartalIntervals[1] ?? 0,
          fifthOffset: quartalIntervals[2] ?? quartalIntervals[1] ?? 0,
          topVoiceOffset: quartalIntervals.length > 3 ? quartalIntervals[3] : null,
          form: chordQuartalSpread,
          layer: "quartal",
          generator: "quartal",
          quartalType: chordQuartalType,
          quartalReference: chordQuartalReference,
          quartalScaleName: chordQuartalScaleName,
          quartalTonicPc: chordRootPc,
          quartalSteps: Array.isArray(activeQuartalVoicing?.quartalSteps) ? [...activeQuartalVoicing.quartalSteps] : [],
          quartalDegree: typeof activeQuartalVoicing?.quartalDegree === "number" ? activeQuartalVoicing.quartalDegree : null,
          ui: { usesManualForm: true, allowThirdInversion: quartalIntervals.length > 3, dropEligible: false },
        };

        return {
          rootPc: quartalRootPc,
          preferSharps: chordPreferSharps,
          title: "Acorde principal",
          chordName: chordQuartalDisplayName,
          notes: quartalNotes,
          intervals: quartalIntervals.map((interval) => intervalToSimpleChordDegreeToken(interval)),
          plan: quartalPlan,
          voicing: quartalVoicing,
          bassName: quartalVoicing?.bassPc != null ? spellNoteFromChordInterval(quartalRootPc, mod12(quartalVoicing.bassPc - quartalRootPc), chordPreferSharps) : "—",
          inversionLabel: quartalVoicing ? actualInversionLabelFromVoicing(quartalPlan, quartalVoicing) : "Según voicing",
        };
      }

      if (chordFamily === "guide_tones") {
        const guideIntervals = guideToneDef.intervals.map(mod12);
        const guidePlan = {
          rootPc: chordRootPc,
          intervals: guideIntervals,
          bassInterval: activeGuideToneVoicing?.bassPc != null
            ? mod12(activeGuideToneVoicing.bassPc - chordRootPc)
            : (guideToneBassIntervalsForSelection(guideToneDef, guideToneInversion === "all" ? "root" : guideToneInversion)[0] ?? 0),
          thirdOffset: guideIntervals[1] ?? 0,
          fifthOffset: guideIntervals[2] ?? guideIntervals[1] ?? 0,
          topVoiceOffset: null,
          form: guideToneForm,
          layer: "guide_tones",
          generator: "exact",
          guideToneQuality,
          ui: { usesManualForm: true, allowThirdInversion: false, dropEligible: false },
        };

        return {
          rootPc: chordRootPc,
          preferSharps: chordPreferSharps,
          title: "Acorde principal",
          chordName: `${guideToneDisplayName} · Notas guía`,
          notes: guideToneDef.intervals.map((interval) => spellNoteFromChordInterval(chordRootPc, interval, chordPreferSharps)),
          intervals: [...guideToneDef.degreeLabels],
          plan: guidePlan,
          voicing: activeGuideToneVoicing,
          bassName: activeGuideToneVoicing?.bassPc != null ? spellNoteFromChordInterval(chordRootPc, mod12(activeGuideToneVoicing.bassPc - chordRootPc), chordPreferSharps) : guideToneBassNote,
          inversionLabel: activeGuideToneVoicing
            ? actualInversionLabelFromVoicing(guidePlan, activeGuideToneVoicing)
            : CHORD_GUIDE_TONE_INVERSIONS.find((x) => x.value === guideToneInversion)?.label || "Fundamental",
        };
      }

      const mainRootPc = chordRootPc;
      const mainPreferSharps = chordPreferSharps;
      const mainIntervals = chordIntervals;
      const mainSpelledNotes = spellChordNotes({ rootPc: mainRootPc, chordIntervals: mainIntervals, preferSharps: mainPreferSharps });
      const mainPcToSpelledName = (pc) => {
        const interval = mod12(pc - mainRootPc);
        const idx = mainIntervals.findIndex((x) => mod12(x) === interval);
        return idx >= 0 ? mainSpelledNotes[idx] : pcToName(pc, mainPreferSharps);
      };

      return {
        rootPc: mainRootPc,
        preferSharps: mainPreferSharps,
        title: "Acorde principal",
        chordName: chordDisplayNameFromUI({
          rootPc: mainRootPc,
          preferSharps: mainPreferSharps,
          quality: chordQuality,
          suspension: chordSuspension,
          structure: chordStructure,
          ext7: chordExt7,
          ext6: chordExt6,
          ext9: chordExt9,
          ext11: chordExt11,
          ext13: chordExt13,
        }),
        notes: mainSpelledNotes,
        intervals: mainIntervals.map((i) => intervalToChordToken(i, { ext6: chordExt6, ext9: chordExt9 && chordStructure !== "triad", ext11: chordExt11 && chordStructure !== "triad", ext13: chordExt13 && chordStructure !== "triad" })),
        plan: chordEnginePlan,
        voicing: activeChordVoicing,
        bassName: activeChordVoicing ? mainPcToSpelledName(activeChordVoicing.bassPc) : pcToName(chordBassPc, mainPreferSharps),
        inversionLabel: activeChordVoicing
          ? actualInversionLabelFromVoicing(chordEnginePlan, activeChordVoicing)
          : CHORD_INVERSIONS.find((x) => x.value === chordInversion)?.label || "Fundamental",
      };
    }

    const idx = Number(studyTarget);
    const slot = nearSlots[idx];
    const plan = nearComputed.ranked[idx]?.plan || null;
    const voicing = nearComputed.selected[idx] || null;
    const pref = slot?.spellPreferSharps ?? preferSharpsFromMajorTonicPc(mod12(slot?.rootPc || 0));
    const ints = buildChordIntervals({
      quality: slot?.quality,
      suspension: slot?.suspension || "none",
      structure: slot?.structure,
      ext7: slot?.ext7,
      ext6: slot?.ext6,
      ext9: slot?.ext9,
      ext11: slot?.ext11,
      ext13: slot?.ext13,
    });
    const notes = spellChordNotes({ rootPc: slot?.rootPc || 0, chordIntervals: ints, preferSharps: pref });
    return {
      rootPc: slot?.rootPc || 0,
      preferSharps: pref,
      title: `Acorde cercano ${idx + 1}`,
      chordName: chordDisplayNameFromUI({
        rootPc: slot?.rootPc || 0,
        preferSharps: pref,
        quality: slot?.quality,
        suspension: slot?.suspension || "none",
        structure: slot?.structure,
        ext7: slot?.ext7,
        ext6: slot?.ext6,
        ext9: slot?.ext9,
        ext11: slot?.ext11,
        ext13: slot?.ext13,
      }),
      notes,
      intervals: ints.map((i) => intervalToChordToken(i, { ext6: !!slot?.ext6, ext9: !!slot?.ext9 && slot?.structure !== "triad", ext11: !!slot?.ext11 && slot?.structure !== "triad", ext13: !!slot?.ext13 && slot?.structure !== "triad" })),
      plan,
      voicing,
      bassName: voicing ? pcToName(voicing.bassPc, pref) : pcToName(mod12((slot?.rootPc || 0) + (plan?.bassInterval || 0)), pref),
      inversionLabel: CHORD_INVERSIONS.find((x) => x.value === (slot?.inversion || "root"))?.label || "Fundamental",
    };
  }, [studyTarget, chordDetectMode, chordDetectSelectedCandidate, chordDetectSelectedNotes, chordFamily, chordRootPc, chordPreferSharps, chordQuality, chordSuspension, chordStructure, chordExt7, chordExt6, chordExt9, chordExt11, chordExt13, chordIntervals, chordEnginePlan, activeChordVoicing, chordBassPc, chordInversion, maxFret, chordQuartalPitchSets, activeQuartalVoicing, chordQuartalCurrentRootPc, chordQuartalDisplayName, chordQuartalSpread, chordQuartalType, chordQuartalReference, guideToneDef, activeGuideToneVoicing, guideToneDisplayName, guideToneForm, guideToneInversion, guideToneQuality, guideToneBassNote, nearSlots, nearComputed]);

  // --------------------------------------------------------------------------
  // COMPONENTES UI INTERNOS: PANEL DE ESTUDIO
  // --------------------------------------------------------------------------

  function StudyPanel() {
    const d = studyData;
    const rules = explainStudyRules(d?.plan);
    const naming = buildChordNamingExplanation(d?.plan);
    const voicingAnalysis = analyzeVoicingVsPlan(d?.plan, d?.voicing, d?.preferSharps ?? chordPreferSharps);
    const isQuartalStudy = d?.plan?.layer === "quartal";
    const quartalReferenceLabel = isQuartalStudy
      ? (
          d?.plan?.quartalReference === "scale"
            ? `Diatónico a la escala ${d?.plan?.quartalScaleName || scaleName} de ${pcToName(d?.plan?.quartalTonicPc ?? chordRootPc, d?.preferSharps ?? chordPreferSharps)}`
            : `Desde raíz de ${pcToName(d?.plan?.quartalTonicPc ?? chordRootPc, d?.preferSharps ?? chordPreferSharps)}`
        )
      : "";
    const quartalStepText = isQuartalStudy && Array.isArray(d?.plan?.quartalSteps) && d.plan.quartalSteps.length
      ? d.plan.quartalSteps.map(buildQuartalStepText).join(" · ")
      : "—";
    const quartalDegreeText = isQuartalStudy && typeof d?.plan?.quartalDegree === "number"
      ? fnBuildQuartalDegreeLabel(d.plan.quartalDegree)
      : "—";
    const tensionAnalysis = analyzeScaleTensionsForChord({
      activeScaleRootPc: rootPc,
      scaleIntervals,
      chordRootPc: d?.rootPc ?? chordRootPc,
      chordIntervals: d?.plan?.intervals || [],
      preferSharps: d?.preferSharps ?? chordPreferSharps,
    });
    const dominant = buildDominantInfo(d?.rootPc ?? chordRootPc, d?.preferSharps ?? chordPreferSharps);
    const backdoorDominant = buildBackdoorDominantInfo(d?.rootPc ?? chordRootPc, d?.preferSharps ?? chordPreferSharps);
    const studyStaffEvents = d?.voicing?.notes?.length
      ? [{ notes: [...d.voicing.notes].sort((a, b) => pitchAt(a.sIdx, a.fret) - pitchAt(b.sIdx, b.fret)).map((n) => pitchAt(n.sIdx, n.fret)) }]
      : [];
    const studyVoicingPositionsText = d?.voicing?.notes?.length
      ? [...d.voicing.notes]
          .sort((a, b) => pitchAt(a.sIdx, a.fret) - pitchAt(b.sIdx, b.fret))
          .map((n) => `${n.sIdx + 1}ª/${n.fret}`)
          .join(" · ")
      : "";
    return (
      <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-800">Modo estudio</div>
            <div className="text-xs text-slate-600">{d?.title} · {d?.chordName}</div>
          </div>
          <button type="button" className={UI_BTN_SM + " w-auto px-3"} onClick={() => setStudyOpen((v) => !v)}>
            {studyOpen ? "Ocultar" : "Ver análisis"}
          </button>
        </div>

        {studyOpen ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">Identidad</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div><b>Nombre:</b> {d?.chordName}</div>
                <div><b>Capa:</b> {chordEngineLayerLabel(d?.plan)}</div>
                <div><b>Generador:</b> {chordEngineGeneratorLabel(d?.plan)}</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">Dominantes relacionados</div>
              <div className="mt-2 space-y-3 text-xs text-slate-600">
                <div>
                  <div className="font-semibold text-slate-700">Dominante normal</div>
                  <div><b>Acorde:</b> {dominant.name}</div>
                  <div><b>Función:</b> {dominant.relation}</div>
                  <div><b>Notas:</b> {dominant.notes.join(" · ")}</div>
                </div>
                <div className="border-t border-slate-200 pt-2">
                  <div className="font-semibold text-slate-700">Backdoor dominant</div>
                  <div><b>Acorde:</b> {backdoorDominant.name}</div>
                  <div><b>Función:</b> {backdoorDominant.relation}</div>
                  <div><b>Notas:</b> {backdoorDominant.notes.join(" · ")}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">Por qué se nombra así</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                {naming.length ? naming.map((r, i) => <div key={i}>• {r}</div>) : <div>• Sin explicación adicional.</div>}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">Construcción</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div><b>Fórmula:</b> {d?.intervals?.join(" · ") || "—"}</div>
                <div><b>Notas:</b> {d?.notes?.join(" · ") || "—"}</div>
                <div><b>Bajo:</b> {d?.bassName || "—"}</div>
                <div><b>Inversión:</b> {d?.inversionLabel}</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">Voicing actual</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div><b>Tipo:</b> {studyVoicingFormLabel(d?.voicing, d?.plan?.form)}</div>
                <div><b>Digitación:</b> {d?.voicing?.frets || "—"}</div>
                <div><b>Distancia:</b> {d?.voicing ? (d.voicing.reach ?? (d.voicing.span + 1)) : "—"}</div>
                <div><b>Rango de alturas:</b> {d?.voicing?.pitchSpan ?? "—"} semitonos</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">{isQuartalStudy ? "Estructura cuartal real" : "Selección vs voicing real"}</div>
              {isQuartalStudy ? (
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <div><b>Apilado pedido:</b> {positionFormLabel(d?.plan?.form)} · <b>Apilado real:</b> {studyVoicingFormLabel(d?.voicing, d?.plan?.form)}</div>
                  <div><b>Referencia:</b> {quartalReferenceLabel}</div>
                  <div><b>Grado real:</b> {quartalDegreeText}</div>
                  <div><b>Cadena de cuartas:</b> {quartalStepText}</div>
                  <div><b>Notas reales:</b> {voicingAnalysis.actualNotes.join(" · ") || "—"}</div>
                  <div><b>Bajo real:</b> {voicingAnalysis.actualBass}</div>
                  <div><b>Inv. real:</b> {voicingAnalysis.actualInversion}</div>
                </div>
              ) : (
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <div><b>Pedido:</b> {voicingAnalysis.requested.join(" · ") || "—"}</div>
                  <div><b>Real:</b> {voicingAnalysis.actual.join(" · ") || "—"}</div>
                  <div><b>Notas reales:</b> {voicingAnalysis.actualNotes.join(" · ") || "—"}</div>
                  <div><b>Forma selección:</b> {voicingAnalysis.requestedForm} · <b>Forma real:</b> {voicingAnalysis.actualForm}</div>
                  <div><b>Bajo selección:</b> {voicingAnalysis.requestedBass} · <b>Bajo real:</b> {voicingAnalysis.actualBass}</div>
                  <div><b>Inv. real:</b> {voicingAnalysis.actualInversion}</div>
                  <div><b>Falta:</b> {voicingAnalysis.missing.join(" · ") || "ninguna"}</div>
                  <div><b>Sobra:</b> {voicingAnalysis.extra.join(" · ") || "nada"}</div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">Tensiones según escala</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div><b>Escala activa:</b> {pcToName(rootPc, preferSharps)} {scaleName}</div>
                <div><b>Disponibles:</b> {tensionAnalysis.available.join(" · ") || "ninguna clara"}</div>
                <div><b>No disponibles:</b> {tensionAnalysis.unavailable.join(" · ") || "ninguna"}</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">Reglas</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                {rules.length ? rules.map((r, i) => <div key={i}>• {r}</div>) : <div>• Sin restricciones especiales.</div>}
              </div>
            </div>

            {studyStaffEvents.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-700">Pentagrama del voicing real</div>
                <div className="mt-1 text-xs text-slate-600">
                  Notas según cuerdas y trastes reales del voicing actual: {studyVoicingPositionsText}
                </div>
                <div className="mt-2">
                  <MusicStaff
                    events={studyStaffEvents}
                    preferSharps={d?.preferSharps ?? chordPreferSharps}
                    clefMode="guitar"
                    keySignature={{ type: null, count: 0 }}
                  />
                </div>
              </div>
            ) : null}
            </div>
          </>
        ) : null}
      </section>
    );
  }


  useEffect(() => {
    setNearSlots((prev) => {
      let changed = false;
      const next = prev.map((slot, idx) => {
        if (!slot?.enabled) return slot;

        const options = nearComputed.ranked[idx]?.ranked || [];
        if (!options.length) {
          return slot;
        }

        let nextFrets = slot.selFrets ?? null;

        const pending = pendingNearRestoreRef.current[idx];
        if (pending?.active) {
          if (pending.frets == null) {
            pendingNearRestoreRef.current[idx] = { active: false, frets: null };
          } else if (options.some((v) => v.frets === pending.frets)) {
            nextFrets = pending.frets;
            pendingNearRestoreRef.current[idx] = { active: false, frets: null };
          } else {
            return slot;
          }
        }

        const keepCurrent = !!nextFrets && options.some((v) => v.frets === nextFrets);
        if (!keepCurrent) {
          const ref = lastNearVoicingsRef.current[idx] || null;
          nextFrets = options[nearestVoicingIndex(ref, options)]?.frets ?? options[0]?.frets ?? null;
        }

        if ((slot.selFrets ?? null) !== (nextFrets ?? null)) {
          changed = true;
          skipNearVoicingRefSyncRef.current[idx] = true;
          return { ...slot, selFrets: nextFrets };
        }
        return slot;
      });

      return changed ? next : prev;
    });
  }, [storageHydrated, nearRankSig]);

  useEffect(() => {
    if (!storageHydrated) return;
    if (!nearSelectedSig) return;
    nearComputed.selected.forEach((v, i) => {
      if (skipNearVoicingRefSyncRef.current[i]) {
        skipNearVoicingRefSyncRef.current[i] = false;
        return;
      }
      if (v) lastNearVoicingsRef.current[i] = v;
    });
  }, [storageHydrated, nearSelectedSig]);


  const spelledScaleNotes = useMemo(() => spellScaleNotes({ rootPc, scaleIntervals, preferSharps }), [rootPc, scaleIntervals, preferSharps]);
  const spelledExtraNotes = useMemo(() => spellScaleNotes({ rootPc, scaleIntervals: extraIntervals, preferSharps }), [rootPc, extraIntervals, preferSharps]);
  const scaleTetradHarmony = useMemo(
    () => buildScaleTetradHarmonization({ rootPc, scaleName, harmonyMode, scaleIntervals, spelledScaleNotes, preferSharps }),
    [rootPc, scaleName, harmonyMode, scaleIntervals, spelledScaleNotes, preferSharps]
  );
  const scaleTetradDegreesText = useMemo(
    () => scaleTetradHarmony.map((x) => x.degreeName).join(" · "),
    [scaleTetradHarmony]
  );
  const scaleTetradNotesText = useMemo(
    () => scaleTetradHarmony.map((x) => x.noteName).join(" · "),
    [scaleTetradHarmony]
  );

  // Acordes de la escala activa (armonización real según la escala seleccionada arriba)
  const harmonizedScale = useMemo(() => {
    const base = nearSlots.find((s) => s?.enabled) || nearSlots?.[0] || {};
    const withSeventh = base.structure === "tetrad" || !!base.ext7;

    const degrees = scaleIntervals.map((interval, i) => {
      const built = buildHarmonyDegreeChord({ scaleName, harmonyMode, scaleIntervals, degreeIndex: i, withSeventh });
      const noteName = spelledScaleNotes[i] || pcToName(mod12(rootPc + interval), preferSharps);
      const chordRootPc2 = mod12(rootPc + interval);

      if (!built) {
        return {
          rootPc: chordRootPc2,
          supported: false,
          name: `${noteName}?`,
          noteName,
        };
      }

      const suffix = chordDisplaySuffixOnly({
        quality: built.quality,
        suspension: built.suspension,
        structure: built.structure,
        ext7: built.ext7,
        ext6: built.ext6,
        ext9: built.ext9,
        ext11: built.ext11,
        ext13: built.ext13,
      });

      return {
        ...built,
        rootPc: chordRootPc2,
        spellPreferSharps: preferSharps,
        supported: true,
        noteName,
        name: `${noteName}${suffix}`,
      };
    });

    return {
      tonicName: spelledScaleNotes[0] || pcToName(rootPc, preferSharps),
      scaleLabel: scaleName,
      withSeventh,
      degrees,
      names: (MANUAL_SCALE_TETRAD_PRESETS[normalizeScaleName(scaleName)] || (withSeventh && scaleTetradHarmony.length)) ? scaleTetradHarmony.map((x) => x.noteName) : degrees.map((d) => d.name),
    };
  }, [
    nearSlots?.[0]?.structure,
    nearSlots?.[0]?.ext7,
    scaleIntervals,
    spelledScaleNotes,
    rootPc,
    harmonyMode,
    preferSharps,
    scaleName,
  ]);

  const nearTonalityAnalysis = useMemo(
    () => analyzeChordSetTonality({ slots: nearSlots, harmonyMode }),
    [nearSlots, harmonyMode]
  );

  useEffect(() => {
    if (!storageHydrated) return;
    if (!nearAutoScaleSync) return;
    setNearSlots((prev) => {
      if (!prev?.length) return prev;

      const s0 = prev[0] || {};
      const withSeventh = s0.structure === "tetrad" || !!s0.ext7;
      const built = buildHarmonyDegreeChord({ scaleName, harmonyMode, scaleIntervals, degreeIndex: 0, withSeventh });
      if (!built) return prev;

      const patch = {
        rootPc: mod12(rootPc + built.rootOffset),
        quality: built.quality,
        suspension: "none",
        structure: built.structure,
        inversion: "root",
        form: "open",
        positionForm: "open",
        ext7: built.ext7,
        ext6: false,
        ext9: false,
        ext11: false,
        ext13: false,
        spellPreferSharps: preferSharps,
      };

      let changed = false;
      for (const k of Object.keys(patch)) {
        if (s0?.[k] !== patch[k]) {
          changed = true;
          break;
        }
      }
      if (!changed) return prev;

      const next = [...prev];
      next[0] = { ...s0, ...patch };
      return next;
    });
  }, [storageHydrated, nearAutoScaleSync, rootPc, scaleName, harmonyMode, scaleIntervals, preferSharps]);

  // Auto-propuesta: si un slot NO está activo, lo ajustamos a grados diatónicos de la escala activa.
  // Se mantienen ii / IV / V como propuesta por defecto cuando existan en la escala.
  useEffect(() => {
    if (!storageHydrated) return;
    if (!nearAutoScaleSync) return;
    setNearSlots((prev) => {
      if (!prev?.length) return prev;

      const preferredDegreeIdx = [1, 3, 4].filter((i) => i < harmonizedScale.degrees.length);
      let changed = false;

      const next = prev.map((s, i) => {
        if (i === 0) return s;
        if (s?.enabled) return s;

        const degree = harmonizedScale.degrees[preferredDegreeIdx[i - 1]];
        if (!degree?.supported) return s;

        const patch = {
          rootPc: degree.rootPc,
          quality: degree.quality,
          suspension: degree.suspension,
          structure: degree.structure,
          inversion: "root",
          form: "open",
          positionForm: "open",
          ext7: degree.ext7,
          ext6: false,
          ext9: false,
          ext11: false,
          ext13: false,
          spellPreferSharps: degree.spellPreferSharps,
        };

        for (const k of Object.keys(patch)) {
          if (s?.[k] !== patch[k]) {
            changed = true;
            return { ...s, ...patch };
          }
        }
        return s;
      });

      return changed ? next : prev;
    });
  }, [storageHydrated, nearAutoScaleSync, harmonizedScale]);


  const spelledChordNotes = useMemo(
    () => spellChordNotes({ rootPc: chordRootPc, chordIntervals, preferSharps: chordPreferSharps }),
    [chordRootPc, chordIntervals, chordPreferSharps]
  );

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

  // --------------------------------------------------------------------------
  // HELPERS LOCALES: ROLES Y ETIQUETAS MUSICALES
  // --------------------------------------------------------------------------

  // Escala activa
  function roleOfPc(pc) {
    const interval = mod12(pc - rootPc);

    // Blues: la “blue note” se pinta como NOTA EXTRA (mismo color que extras), aunque forme parte de la escala.
    // - Blues (menor): b5 / #4 => 6
    // - Blues (mayor): b3 => 3
    const bluesBlue = scaleName === "Pentatónica menor + blue note" ? 6 : scaleName === "Pentatónica mayor + blue note" ? 3 : null;
    if (bluesBlue != null && interval === bluesBlue) return "extra";

    if (interval === 0) return "root";
    if (thirdOffsets.includes(interval)) return "third";
    if (interval === 7) return "fifth";
    return "other";
  }

  // Acorde principal
  function chordRoleOfPc(pc) {
    const interval = mod12(pc - chordRootPc);
    const seventh = chordExt7 ? seventhOffsetForQuality(chordQuality) : null;

    if (interval === 0) return "root";
    if (interval === chordThirdOffset) return "third";
    if (interval === chordFifthOffset) return "fifth";
    if (hasEffectiveSeventh({ structure: chordStructure, ext7: chordExt7, ext6: chordExt6, ext9: chordExt9, ext11: chordExt11, ext13: chordExt13 }) && seventh != null && interval === mod12(seventh)) return "seventh";
    if (chordExt13 && interval === 9) return "thirteenth";
    if (chordExt11 && interval === 5) return "eleventh";
    if (chordExt9 && interval === 2) return "ninth";
    if (chordExt6 && interval === 9) return "sixth";
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

  function labelForCellAt(sIdx, fret) {
    return labelForPc(mod12(STRINGS[sIdx].pc + fret));
  }

  // Etiqueta rápida al pasar el ratón por una celda
  function hoverCellNoteText(sIdx, fret) {
    const pc = mod12(STRINGS[sIdx].pc + fret);
    return pcToDualName(pc);
  }

  function labelForChordPc(pc) {
    const interval = mod12(pc - chordRootPc);
    const itv = intervalToChordToken(interval, { ext6: chordExt6, ext9: chordExt9 && chordStructure !== "triad", ext11: chordExt11 && chordStructure !== "triad", ext13: chordExt13 && chordStructure !== "triad" });
    const note = chordPcToSpelledName(pc);

    const showI = !!showIntervalsLabel;
    const showN = !!showNotesLabel;

    if (!showI && !showN) return itv;
    if (showI && showN) return `${itv}-${note}`;
    if (showI) return itv;
    return note;
  }

  // --------------------------------------------------------------------------
  // HELPERS LOCALES: MUTADORES DE COLOR Y AJUSTES VISUALES
  // --------------------------------------------------------------------------

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

  function setClusterTestDot(idx, key, value) {
    setClusterTestDots((prev) => prev.map((dot, i) => {
      if (i !== idx) return dot;
      const n = Number(value);
      if (!Number.isFinite(n)) return dot;
      return {
        ...dot,
        [key]: key === "size"
          ? Math.max(8, Math.min(40, n))
          : Math.max(-20, Math.min(80, n)),
      };
    }));
  }

  // --------------------------------------------------------------------------
  // CÁLCULOS DERIVADOS: PATRONES, RUTA Y ESCALAS
  // --------------------------------------------------------------------------

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

  const kingBoxOverlay = useMemo(
    () => buildKingBoxOverlayMap({
      enabled: isKingBoxEligibleScale && showKingBoxes,
      mode: kingBoxMode,
      rootPc,
      maxFret,
    }),
    [isKingBoxEligibleScale, showKingBoxes, kingBoxMode, rootPc, maxFret]
  );

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
  const routeLabStartPos = useMemo(() => parsePosCode(routeLabStartCode), [routeLabStartCode]);
  const routeLabEndPos = useMemo(() => parsePosCode(routeLabEndCode), [routeLabEndCode]);

  const routeLabCurrentTuning = useMemo(() => ({
    ...ROUTE_LAB_DEFAULT_TUNING,
    switchWhenSameStringForwardPenalty: routeLabSwitchWhenSameStringForwardPenalty,
    worseThanSameStringGoalBase: routeLabWorseThanSameStringGoalBase,
    worseThanSameStringGoalScale: routeLabWorseThanSameStringGoalScale,
    corridorPenalty: routeLabCorridorPenalty,
    overshootNearEndAlt: routeLabOvershootNearEndAlt,
  }), [
    routeLabSwitchWhenSameStringForwardPenalty,
    routeLabWorseThanSameStringGoalBase,
    routeLabWorseThanSameStringGoalScale,
    routeLabCorridorPenalty,
    routeLabOvershootNearEndAlt,
  ]);

  const routeLabResult = useMemo(() => computeRouteLab({
    rootPc,
    scaleName,
    scaleIntervals,
    maxFret,
    startPos: routeLabStartPos,
    endPos: routeLabEndPos,
    maxNotesPerString: routeLabMaxPerString,
    tuning: routeLabCurrentTuning,
  }), [
    rootPc,
    scaleName,
    scaleIntervals,
    maxFret,
    routeLabStartPos,
    routeLabEndPos,
    routeLabMaxPerString,
    routeLabCurrentTuning,
  ]);

  const routeLabIndexByCell = useMemo(() => {
    const m = new Map();
    routeLabResult.path.forEach((n, i) => m.set(`${n.sIdx}:${n.fret}`, i + 1));
    return m;
  }, [routeLabResult.path]);

  const routeLabText = useMemo(
    () => routeLabResult.path.map((n) => `${n.sIdx + 1}${n.fret}`).join(" \u2192 "),
    [routeLabResult.path]
  );

  const routeKeySignature = useMemo(
    () => resolveKeySignatureForScale({ rootPc, scaleName }),
    [rootPc, scaleName]
  );

  const routeStaffEvents = useMemo(
    () => routeLabResult.path.map((n) => ({ notes: [pitchAt(n.sIdx, n.fret)] })),
    [routeLabResult.path]
  );

  const routeLabDebugLines = useMemo(() => {
    return (routeLabResult.debugSteps || []).map((step, idx) => {
      const chunks = [];
      chunks.push(`${idx + 1}. ${step.from} \u2192 ${step.to}`);
      chunks.push(step.sameString ? `misma cuerda · ${step.df} trastes` : `cambio cuerda ${step.ds} · ${step.df} trastes`);
      chunks.push(`bloque=${step.runCount}`);
      chunks.push(`corredor=${step.corridorDev}`);
      if (step.targetSideOvershoot > 0) chunks.push(`overshoot objetivo=${step.targetSideOvershoot}`);
      if (step.hadSameStringForward && step.bestSameStringForwardFret != null && !step.sameString) {
        chunks.push(`había opción misma cuerda hacia traste ${step.bestSameStringForwardFret}`);
      }
      if (step.hadNonOvershootingAlternative && step.targetSideOvershoot > 0) {
        chunks.push(`había alternativa sin pasarse del objetivo`);
      }
      if (step.templateText) {
        chunks.push(step.templateText);
      }
      chunks.push(`coste paso=${step.stepCost}`);
      chunks.push(`coste acumulado=${step.totalCost}`);
      return chunks.join(" · ");
    });
  }, [routeLabResult.debugSteps]);

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

      const baseArgs = {
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
        strictFretDirection: routeStrictFretDirection,
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

      const tries = routeStrictFretDirection ? [1, -1] : [0];
      let bestTry = { res: { path: [], cost: null, reason: "No encontré ruta" }, score: Infinity };

      for (const forcedTrend of tries) {
        const res = computeMusicalRoute({ ...baseArgs, forcedFretTrend: forcedTrend });
        if (res.reason) continue;
        const score = (res.cost ?? 0) + modePenalty(m);
        if (score < bestTry.score) bestTry = { res, score };
      }

      return bestTry;
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
    routeStrictFretDirection,
    pentaBoxInstances,
    pentaBoxMembership,
    npsInstances,
    npsMembership,
    cagedInstances,
    cagedMembership,
  ]);

  const routeIndexByCell = useMemo(() => {
    const m = new Map();
    routeResult.path.forEach((n, i) => m.set(`${n.sIdx}:${n.fret}`, i + 1));
    return m;
  }, [routeResult.path]);

  // --------------------------------------------------------------------------
  // COMPONENTES UI INTERNOS: ELEMENTOS BASE
  // --------------------------------------------------------------------------

  function HoverCellNote({ sIdx, fret, visible }) {
    if (!visible) return null;
    return (
      <div className="pointer-events-none absolute inset-0 z-[6] hidden items-center justify-center text-[10px] font-semibold text-slate-500 group-hover:flex">
        {hoverCellNoteText(sIdx, fret)}
      </div>
    );
  }

  function ToggleButton({ active, onClick, children, title }) {
    const fallbackTitle = typeof children === "string" ? children : "";
    return (
      <button
        type="button"
        onClick={onClick}
        title={title || fallbackTitle}
        className={`rounded-xl px-2 py-1.5 text-sm ring-1 ring-slate-200 shadow-sm ${active ? "bg-slate-900 text-white" : "bg-white"}`}
      >
        {children}
      </button>
    );
  }

  function FretInlayRow({ kind }) {
    const isDouble = kind === "double";
    return (
      <div className="grid items-center gap-1" style={{ gridTemplateColumns: fretGridCols(maxFret) }}>
        <div className="text-xs font-medium text-slate-700" />
        {Array.from({ length: maxFret + 1 }, (_, fret) => {
          const has = isDouble ? INLAY_DOUBLE.has(fret) : INLAY_SINGLE.has(fret);
          return (
            <div key={fret} className="relative flex h-4 items-center justify-center">
              {has ? <div className="h-4 w-4 rounded-full bg-slate-300 opacity-95" /> : null}
            </div>
          );
        })}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // COMPONENTES UI INTERNOS
  // --------------------------------------------------------------------------

  function Circle({ pc, role, fret, sIdx, badge, kingTags = [] }) {
    const baseRole = role === "extra" ? "extra" : role;
    const tagList = Array.isArray(kingTags) ? kingTags : [];
    const baseStyle = circleStyle(baseRole);
    const boxShadowParts = [baseStyle.boxShadow].filter(Boolean);
    if (tagList.includes("bb")) boxShadowParts.push(`0 0 0 4px ${kingBoxColors.bb}`);
    if (tagList.includes("albert")) boxShadowParts.push(`0 0 0 6px ${kingBoxColors.albert}`);
    const kingTitle = tagList.length
      ? ` · ${tagList.map((tag) => tag === "bb" ? KING_BOX_DEFAULTS.bb.label : KING_BOX_DEFAULTS.albert.label).join(" + ")}`
      : "";
    return (
      <div
        className="relative z-20 inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
        style={{ ...baseStyle, boxShadow: boxShadowParts.join(", ") }}
        title={`${pcToDualName(pc)} · ${intervalToDegreeToken(mod12(pc - rootPc))}${kingTitle}`}
      >
        {labelForPc(pc)}
        {badge ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold leading-none text-slate-700 shadow-sm ring-1 ring-slate-200">
            {badge}
          </span>
        ) : null}
      </div>
    );
  }

  function quartalRoleOfPc(pc) {
    const interval = mod12(pc - chordQuartalCurrentRootPc);
    const degreeRaw = intervalToSimpleChordDegreeToken(interval);
    return chordBadgeRoleFromDegreeLabel(degreeRaw, interval);
  }

  function labelForQuartalPc(pc) {
    const interval = mod12(pc - chordQuartalCurrentRootPc);
    const degreeRaw = intervalToSimpleChordDegreeToken(interval);
    const degree = formatChordBadgeDegree(degreeRaw);
    const note = spellNoteFromChordInterval(chordQuartalCurrentRootPc, interval, chordPreferSharps);

    const showI = !!showIntervalsLabel;
    const showN = !!showNotesLabel;

    if (!showI && !showN) return degree;
    if (showI && showN) return `${degree}-${note}`;
    if (showI) return degree;
    return note;
  }

  function quartalNoteNameForPc(pc) {
    const interval = mod12(pc - chordQuartalCurrentRootPc);
    return spellNoteFromChordInterval(chordQuartalCurrentRootPc, interval, chordPreferSharps);
  }

function ChordCircle({ role, isBass, displayLabel, titleText }) {
  const bg = colors[role] || colors.other;
  const dark = isDark(bg);

  return (
    <div
      className="relative z-20 inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
      style={{
        backgroundColor: bg,
        color: role === "other" ? "#0f172a" : dark ? "#ffffff" : "#0f172a",
        boxShadow: isBass
          ? `inset 0 0 0 2px ${rgba("#000000", 0.95)}`
          : `0 0 0 2px ${rgba(bg, 0.25)}`,
      }}
      title={titleText}
    >
      {displayLabel}
    </div>
  );
}



  function guideToneRoleOfPc(pc) {
    const interval = mod12(pc - chordRootPc);
    if (interval === mod12(guideToneDef.intervals[0])) return "root";
    if (interval === mod12(guideToneDef.intervals[1])) return "third";
    return String(guideToneDef.degreeLabels?.[2] || "7").includes("6") ? "sixth" : "seventh";
  }

  function labelForGuideTonePc(pc) {
    const interval = mod12(pc - chordRootPc);
    const idx = guideToneDef.intervals.findIndex((x) => mod12(x) === interval);
    const degreeRaw = guideToneDef.degreeLabels[idx] || intervalToSimpleChordDegreeToken(interval);
    const degree = formatChordBadgeDegree(degreeRaw);
    const note = spellNoteFromChordInterval(chordRootPc, interval, chordPreferSharps);

    const showI = !!showIntervalsLabel;
    const showN = !!showNotesLabel;
    if (!showI && !showN) return degree;
    if (showI && showN) return `${degree}-${note}`;
    if (showI) return degree;
    return note;
  }

  function GuideToneCircle({ pc, isBass }) {
    const role = guideToneRoleOfPc(pc);
    const bg = colors[role] || colors.other;
    const dark = isDark(bg);
    return (
      <div
        className="relative z-20 inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
        style={{
          backgroundColor: bg,
          color: role === "other" ? "#0f172a" : dark ? "#ffffff" : "#0f172a",
          boxShadow: isBass ? `inset 0 0 0 2px ${rgba("#000000", 0.95)}` : `0 0 0 2px ${rgba(bg, 0.25)}`,
        }}
        title={`${spellNoteFromChordInterval(chordRootPc, mod12(pc - chordRootPc), chordPreferSharps)} · ${labelForGuideTonePc(pc)}${isBass ? " · bajo" : ""}`}
      >
        {labelForGuideTonePc(pc)}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // COMPONENTES UI INTERNOS: ACORDES Y DETECCIÓN
  // --------------------------------------------------------------------------

function ChordFretboard({
  title,
  subtitle = "",
  voicing,
  voicingIdx,
  voicingTotal,
  roleForPc = chordRoleOfPc,
  labelForPc = labelForChordPc,
  noteNameForPc = chordPcToSpelledName,
}) {
  const notesMap = useMemo(() => {
    const m = new Map();
    if (!voicing?.notes?.length) return m;
    for (const n of voicing.notes) {
      m.set(`${n.sIdx}:${n.fret}`, {
        pc: n.pc,
        isBass: `${n.sIdx}:${n.fret}` === voicing.bassKey,
      });
    }
    return m;
  }, [voicing]);

  const mutedStrings = useMemo(
    () => new Set(Array.isArray(voicing?.mutedSIdx) ? voicing.mutedSIdx : []),
    [voicing]
  );

  const noteText = voicing
    ? [...voicing.notes]
        .sort((a, b) => pitchAt(a.sIdx, a.fret) - pitchAt(b.sIdx, b.fret))
        .map((n) => noteNameForPc(n.pc))
        .join(" – ")
    : "";

  return (
    <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          <div className="text-xs text-slate-600">
            {voicing ? `Notas: ${noteText}. Bajo marcado con anillo negro.` : "No hay voicings para esta selección."}
          </div>
          {subtitle ? <div className="text-xs text-slate-600">{subtitle}</div> : null}
        </div>

        {voicing ? (
          <div className="text-xs text-slate-600">
            Voicing {Math.min(voicingIdx + 1, voicingTotal)}/{voicingTotal}: <b>{voicing.frets}</b>
          </div>
        ) : null}
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
          <div
            key={st.label}
            className="grid items-center gap-1"
            style={{ gridTemplateColumns: fretGridCols(maxFret) }}
          >
            <div className="text-xs font-medium text-slate-700">{st.label}</div>

            {Array.from({ length: maxFret + 1 }, (_, fret) => {
              const cellKey = `${sIdx}:${fret}`;
              const item = notesMap.get(cellKey);

              return (
                <div
                  key={`${sIdx}-${fret}`}
                  className={`group relative isolate flex h-8 overflow-visible items-center justify-center rounded-lg border ${
                    fret === 0 ? "border-slate-300" : "border-slate-200"
                  } ${item ? "z-[4]" : "z-0"}`}
                  style={{ backgroundColor: FRET_CELL_BG }}
                >
                  <HoverCellNote sIdx={sIdx} fret={fret} visible={!item} />

                  {hasInlayCell(fret, sIdx) ? (
                    <div
                      className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 -translate-y-1/2"
                      style={{ top: "78%" }}
                    >
                      <div className="h-4 w-4 rounded-full bg-slate-300 opacity-80" />
                    </div>
                  ) : null}

                  {item ? (
                    <ChordCircle
                      role={roleForPc(item.pc)}
                      isBass={item.isBass}
                      displayLabel={labelForPc(item.pc)}
                      titleText={`${noteNameForPc(item.pc)}${item.isBass ? " · bajo" : ""}`}
                    />
                  ) : fret === 0 && mutedStrings.has(sIdx) ? (
                    <span className="text-xs font-semibold text-slate-400">X</span>
                  ) : showNonScale ? (
                    <div className="text-[10px] text-slate-400">{labelForCellAt(sIdx, fret)}</div>
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


  function ChordInvestigationCircle({ pc, fret, sIdx, candidate, isBass }) {
    const role = buildDetectedCandidateRoleForPc(pc, candidate);
    const bg = colors[role] || colors.other;
    const dark = isDark(bg);
    const noteLabel = buildDetectedCandidateLabelForPc(pc, candidate, chordPreferSharps, showIntervalsLabel, showNotesLabel);
    return (
      <div
        className="relative z-20 inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
        style={{
          backgroundColor: bg,
          color: role === "other" ? "#0f172a" : dark ? "#ffffff" : "#0f172a",
          boxShadow: isBass ? `inset 0 0 0 2px ${rgba("#000000", 0.95)}` : `0 0 0 2px ${rgba(bg, 0.25)}`,
        }}
        title={`${noteLabel}${isBass ? " · bajo" : ""}`}
      >
        {noteLabel}
      </div>
    );
  }

  function GuideToneFretboard({ title, voicing, voicingIdx, voicingTotal }) {
    const notesMap = useMemo(() => {
      const m = new Map();
      if (!voicing?.notes?.length) return m;
      for (const n of voicing.notes) {
        m.set(`${n.sIdx}:${n.fret}`, {
          pc: n.pc,
          isBass: `${n.sIdx}:${n.fret}` === voicing.bassKey,
        });
      }
      return m;
    }, [voicing]);

    const mutedStrings = useMemo(
      () => new Set(Array.isArray(voicing?.mutedSIdx) ? voicing.mutedSIdx : []),
      [voicing]
    );

    const noteText = voicing
      ? [...voicing.notes]
          .sort((a, b) => pitchAt(a.sIdx, a.fret) - pitchAt(b.sIdx, b.fret))
          .map((n) => spellNoteFromChordInterval(chordRootPc, mod12(n.pc - chordRootPc), chordPreferSharps))
          .join(" – ")
      : "";

    return (
      <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-800">{title}</div>
            <div className="text-xs text-slate-600">{voicing ? `Notas: ${noteText}. Bajo marcado con anillo negro.` : "No hay voicings para esta selección."}</div>
            {voicing ? (
              <div className="mt-1 text-xs text-slate-600">
                Shells de 3 notas con 1, 3 y 7 según la calidad. Forma e inversión afectan al voicing real.
              </div>
            ) : null}
          </div>
          {voicing ? <div className="text-xs text-slate-600">Voicing {Math.min(voicingIdx + 1, voicingTotal)}/{voicingTotal}: <b>{voicing.frets}</b></div> : null}
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
                const item = notesMap.get(cellKey);
                return (
                  <div
                    key={`${sIdx}-${fret}`}
                    className={`group relative isolate flex h-8 overflow-visible items-center justify-center rounded-lg border ${fret === 0 ? "border-slate-300" : "border-slate-200"} ${item ? "z-[4]" : "z-0"}`}
                    style={{ backgroundColor: FRET_CELL_BG }}
                  >
                    <HoverCellNote sIdx={sIdx} fret={fret} visible={!item} />
                    {hasInlayCell(fret, sIdx) ? (
                      <div className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 -translate-y-1/2" style={{ top: "78%" }}>
                        <div className="h-4 w-4 rounded-full bg-slate-300 opacity-80" />
                      </div>
                    ) : null}
                    {item ? <GuideToneCircle pc={item.pc} isBass={item.isBass} /> : (fret === 0 && mutedStrings.has(sIdx) ? <span className="text-xs font-semibold text-slate-400">X</span> : (showNonScale ? <div className="text-[10px] text-slate-400">{labelForCellAt(sIdx, fret)}</div> : null))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    );
  }

  function ChordInvestigationFretboard() {
    const selectedMap = useMemo(() => {
      const m = new Map();
      if (!chordDetectSelectedNotes.length) return m;
      const bassKey = chordDetectSelectedNotes[0]?.key || null;
      for (const n of chordDetectSelectedNotes) {
        m.set(`${n.sIdx}:${n.fret}`, {
          pc: n.pc,
          isBass: n.key === bassKey,
        });
      }
      return m;
    }, [chordDetectSelectedNotes]);

    const selectedStrings = useMemo(
      () => new Set(chordDetectSelectedNotes.map((n) => n.sIdx)),
      [chordDetectSelectedNotes]
    );

    return (
      <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-800">
              {chordDetectSelectedCandidate ? `Acorde por selección manual - ${chordDetectSelectedCandidate.name}` : "Acorde por selección manual"}
            </div>
            {chordDetectSelectedCandidate ? (
              <>
                <div className="mt-1">
                  <ChordNoteBadgeStrip
                    items={chordDetectSelectedCandidateBadgeItems}
                    bassNote={chordDetectSelectedCandidateBassNote}
                    colorMap={colors}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-600">Notas de la escala: {chordDetectSelectedCandidateScaleNotesText}</div>
              </>
            ) : (
              <div className="text-xs text-slate-600">Pulsa en el mástil para añadir o quitar notas y detectar acordes posibles.</div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={chordDetectClickAudio}
              onChange={(e) => setChordDetectClickAudio(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Sonido al pulsar
          </label>
          <button
            type="button"
            className={UI_BTN_SM + " w-auto px-3"}
            onClick={() => fnPlayChordDetectSelection()}
            disabled={!chordDetectSelectedKeys.length}
          >
            Play
          </button>
          <button
            type="button"
            className={UI_BTN_SM + " w-auto px-3"}
            onClick={() => {
              setChordDetectSelectedKeys([]);
              setChordDetectCandidateId(null);
            }}
            disabled={!chordDetectSelectedKeys.length}
          >
            Limpiar
          </button>
        </div>
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
                const key = `${sIdx}:${fret}`;
                const item = selectedMap.get(key);
                return (
                  <button
                    key={`${sIdx}-${fret}`}
                    type="button"
                    onClick={() => toggleChordDetectCell(sIdx, fret)}
                    className={`group relative isolate flex h-8 overflow-visible items-center justify-center rounded-lg border ${fret === 0 ? "border-slate-300" : "border-slate-200"} ${item ? "z-[4]" : "z-0"} bg-slate-50 hover:ring-2 hover:ring-slate-300`}
                  >
                    <HoverCellNote sIdx={sIdx} fret={fret} visible={!item} />
                    {hasInlayCell(fret, sIdx) ? (
                      <div className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 -translate-y-1/2" style={{ top: "78%" }}>
                        <div className="h-4 w-4 rounded-full bg-slate-300 opacity-80" />
                      </div>
                    ) : null}
                    {item ? <ChordInvestigationCircle pc={item.pc} fret={fret} sIdx={sIdx} candidate={chordDetectSelectedCandidate} isBass={item.isBass} /> : (fret === 0 && !selectedStrings.has(sIdx) ? <span className="text-xs font-semibold text-slate-400">X</span> : (showNonScale ? <div className="text-[10px] text-slate-400">{chordDetectSelectedCandidate ? buildDetectedCandidateBackgroundLabelForPc(mod12(STRINGS[sIdx].pc + fret), chordDetectSelectedCandidate, chordPreferSharps, showIntervalsLabel, showNotesLabel) : labelForCellAt(sIdx, fret)}</div> : null))}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-slate-600">
          {chordDetectSelectedNotes.length
            ? <><b>Notas seleccionadas:</b> {chordDetectSelectedNotesText}. Pulsa de nuevo para quitar una nota.</>
            : "Notas seleccionadas: —"}
        </div>

        {chordDetectStaffEvents.length ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-700">Pentagrama de la selección actual</div>
            <div className="mt-1 text-xs text-slate-600">
              Se dibuja al pulsar notas, sin esperar a elegir un acorde posible: {chordDetectSelectionPositionsText}
            </div>
            <div className="mt-2">
              <MusicStaff
                events={chordDetectStaffEvents}
                preferSharps={chordDetectSelectedCandidate?.preferSharps ?? chordPreferSharps}
                clefMode="guitar"
                keySignature={{ type: null, count: 0 }}
              />
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  // Roles por slot (acordes cercanos)
  function slotRoleOfPc(pc, slot) {
    const interval = mod12(pc - slot.rootPc);
    const third = chordThirdOffsetFromUI(slot.quality, slot.suspension || "none");
    const fifth = chordFifthOffsetFromUI(slot.quality, slot.suspension || "none");
    const seventh = seventhOffsetForQuality(slot.quality);

    if (interval === 0) return "root";
    if (interval === third) return "third";
    if (interval === fifth) return "fifth";
    if (hasEffectiveSeventh({ structure: slot.structure, ext7: slot.ext7, ext6: slot.ext6, ext9: slot.ext9, ext11: slot.ext11, ext13: slot.ext13 }) && interval === mod12(seventh)) return "seventh";
    if (slot.ext13 && interval === 9) return "thirteenth";
    if (slot.ext11 && interval === 5) return "eleventh";
    if (slot.ext9 && interval === 2) return "ninth";
    if (slot.ext6 && interval === 9) return "sixth";
    return "other";
  }

  // Etiqueta por slot (acordes cercanos)
  function slotLabelForPc(slot, pc) {
    const ints = buildChordIntervals({
      quality: slot.quality,
      suspension: slot.suspension || "none",
      structure: slot.structure,
      ext7: slot.ext7,
      ext6: slot.ext6,
      ext9: slot.ext9,
      ext11: slot.ext11,
      ext13: slot.ext13,
    });
    const pref = slot?.spellPreferSharps ?? preferSharpsFromMajorTonicPc(mod12(slot.rootPc));
    const spelled = spellChordNotes({ rootPc: slot.rootPc, chordIntervals: ints, preferSharps: pref });
    const interval = mod12(pc - slot.rootPc);
    const idx = ints.findIndex((x) => mod12(x) === interval);
    const note = idx >= 0 ? spelled[idx] : pcToName(pc, pref);
    const tok = intervalToChordToken(interval, {
      ext6: !!slot.ext6,
      ext9: !!slot.ext9 && slot.structure !== "triad",
      ext11: !!slot.ext11 && slot.structure !== "triad",
      ext13: !!slot.ext13 && slot.structure !== "triad",
    });

    const showI = !!showIntervalsLabel;
    const showN = !!showNotesLabel;
    if (!showI && !showN) return tok;
    if (showI && showN) return `${tok}-${note}`;
    if (showI) return tok;
    return note;
  }

  // --------------------------------------------------------------------------
  // HELPERS LOCALES: DISTRIBUCIÓN VISUAL DE SOLAPES
  // --------------------------------------------------------------------------

  function calibratedClusterPos(n, idx) {
    if (n === 2) {
      const p = [
        { x: 19, y: 16 },
        { x: 52, y: 16 },
      ][idx];
      return p ? { left: `${p.x}px`, top: `${p.y}px`, transform: "translate(-50%, -50%)" } : null;
    }
    if (n === 4) {
      const p = [
        { x: 35, y: 6 },
        { x: 12, y: 14 },
        { x: 57, y: 14 },
        { x: 34, y: 25 },
      ][idx];
      return p ? { left: `${p.x}px`, top: `${p.y}px`, transform: "translate(-50%, -50%)" } : null;
    }
    if (n === 3) {
      const p = [
        { x: 12, y: 14 },
        { x: 34, y: 14 },
        { x: 57, y: 14 },
      ][idx];
      return p ? { left: `${p.x}px`, top: `${p.y}px`, transform: "translate(-50%, -50%)" } : null;
    }
    return null;
  }

  function cornerStyle(n, idx) {
    if (n <= 1) return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
    if (n === 2) {
      return idx === 0
        ? { left: 16, top: "50%", transform: "translateY(-50%)" }
        : { right: 16, top: "50%", transform: "translateY(-50%)" };
    }
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }

  function Mini({ slotIdx, pc, role, fret, sIdx, size = "m" }) {
    const slot = nearSlots[slotIdx];
    const chordBg = nearBgColors[slotIdx] || "#94a3b8";
    const ring = colors[role] || colors.other;
    const dark = isDark(chordBg);
    const sizeClass = size === "cal"
      ? "h-[21px] w-[21px] text-[8px]"
      : size === "pair"
        ? "h-[26px] w-[26px] text-[10px]"
        : size === "s"
          ? "h-6 w-6 text-[9px]"
          : "h-7 w-7 text-[10px]";

    return (
      <div
        className={`relative z-20 inline-flex items-center justify-center rounded-full font-bold ${sizeClass}`}
        title={`${slotLabelForPc(slot, pc)} · acorde ${slotIdx + 1}`}
      >
        <span
          className="absolute inset-0 z-[1] rounded-full"
          style={{
            backgroundColor: chordBg,
            border: `2px solid ${ring}`,
            boxSizing: "border-box",
          }}
        />
        <span className="relative z-[2]" style={{ color: dark ? "#fff" : "#0f172a" }}>
          {slotLabelForPc(slot, pc)}
        </span>
      </div>
    );
  }

  function NearChordsFretboard() {
    const baseSlotIdx = nearComputed.baseIdx;
    const baseSlot = baseSlotIdx >= 0 ? nearSlots[baseSlotIdx] : null;
    const basePlan = baseSlotIdx >= 0 ? (nearComputed.ranked[baseSlotIdx]?.plan || null) : null;
    const baseVoicing = baseSlotIdx >= 0 ? (nearComputed.selected[baseSlotIdx] || null) : null;
    const baseChordName = baseSlot
      ? chordDisplayNameFromUI({
          rootPc: baseSlot.rootPc,
          preferSharps: baseSlot?.spellPreferSharps ?? preferSharpsFromMajorTonicPc(mod12(baseSlot.rootPc)),
          quality: baseSlot.quality,
          suspension: baseSlot.suspension || "none",
          structure: baseSlot.structure,
          ext7: baseSlot.ext7,
          ext6: baseSlot.ext6,
          ext9: baseSlot.ext9,
          ext11: baseSlot.ext11,
          ext13: baseSlot.ext13,
        })
      : null;
    const baseChordDisplayName = baseSlot
      ? buildChordHeaderSummary({
          name: baseChordName,
          plan: basePlan,
          voicing: baseVoicing,
          positionForm: baseSlot.positionForm,
        })
      : null;
    const slotDataMaps = nearComputed.selected.map((v, idx) => {
      const notesMap = new Map();
      if (!nearSlots[idx]?.enabled || !v?.notes?.length) return { notesMap };
      for (const n of v.notes) {
        notesMap.set(`${n.sIdx}:${n.fret}`, {
          pc: n.pc,
          isBass: `${n.sIdx}:${n.fret}` === v.bassKey,
        });
      }
      return { notesMap };
    });

    const activeCount = nearSlots.filter((s) => s?.enabled).length;

    const usedStrings = useMemo(() => {
      const out = new Set();
      nearComputed.selected.forEach((v, idx) => {
        if (!nearSlots[idx]?.enabled || !v?.notes?.length) return;
        v.notes.forEach((n) => out.add(n.sIdx));
      });
      return out;
    }, [nearComputed.selected, nearSlots]);

    return (
      <section className="mt-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-800">Mástil: acordes cercanos</div>
            {baseChordName ? <div className="text-xs text-slate-600"><b>Acorde activo:</b> {baseChordName}</div> : null}
            <div className="text-xs text-slate-600">Acordes de la escala de {harmonizedScale.tonicName} · {harmonizedScale.scaleLabel}: {harmonizedScale.names.join(" · ")}</div>
            <div className="text-xs text-slate-600">Relleno = color del acorde · borde = función (1/3/5/7/otras) · texto = nota/intervalo.</div>
          </div>
          <div className="flex flex-wrap items-end justify-end gap-3">
            <div className="flex items-end gap-1.5">
              <div className="text-xs font-semibold text-slate-700">Rango</div>
              <button
                type="button"
                className={UI_BTN_SM}
                title="Mover rango 1 traste a la izquierda"
                onClick={() => setNearWindowStart((s) => Math.max(0, s - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-end gap-1.5">
                <div>
                  <div className="text-[10px] font-semibold text-slate-600">Inicio</div>
                  <input
                    className={UI_INPUT_SM + " w-14"}
                    value={nearFrom}
                    onChange={(e) => setNearWindowStart(parseInt(e.target.value || "0", 10))}
                  />
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-600">Tamaño</div>
                  <input
                    className={UI_INPUT_SM + " w-14"}
                    value={nearWindowSize}
                    onChange={(e) => setNearWindowSize(parseInt(e.target.value || "1", 10))}
                  />
                </div>
              </div>

              <button
                type="button"
                className={UI_BTN_SM}
                title="Mover rango 1 traste a la derecha"
                onClick={() => setNearWindowStart((s) => Math.min(nearStartMax, s + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="ml-1 text-xs text-slate-600 tabular-nums">
                {nearFrom}–{nearTo}
              </div>
            </div>

            <div className="text-xs text-slate-600">
              Activos: {activeCount ? nearSlots.map((s, i) => (s?.enabled ? `A${i + 1}` : null)).filter(Boolean).join(" · ") : "(ninguno)"}
            </div>
          </div>
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
            <React.Fragment key={st.label}>
              <div className="grid items-center gap-1" style={{ gridTemplateColumns: fretGridCols(maxFret) }}>
                <div className="text-xs font-medium text-slate-700">{st.label}</div>

                {Array.from({ length: maxFret + 1 }, (_, fret) => {
                  const items = [];
                  for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
                    if (!nearSlots[slotIdx]?.enabled) continue;
                    const n = slotDataMaps[slotIdx].notesMap.get(`${sIdx}:${fret}`);
                    if (!n) continue;
                    items.push({ slotIdx, pc: n.pc, role: slotRoleOfPc(n.pc, nearSlots[slotIdx]) });
                  }

                  return (
                    <div
                      key={`${sIdx}-${fret}`}
                      className={`group relative isolate flex h-8 overflow-visible items-center justify-center rounded-lg border ${fret === 0 ? "border-slate-300" : "border-slate-200"} ${items.length ? "z-[4]" : "z-0"}`}
                      style={{ backgroundColor: FRET_CELL_BG }}
                    >
                      <HoverCellNote sIdx={sIdx} fret={fret} visible={!items.length} />
                      {hasInlayCell(fret, sIdx) ? (
                      <div className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 -translate-y-1/2" style={{ top: "78%" }}>
                        <div className="h-4 w-4 rounded-full bg-slate-300 opacity-80" />
                      </div>
                    ) : null}
                      {fret >= nearFrom && fret <= nearTo ? (
                        <div className="pointer-events-none absolute inset-0 z-[2] rounded-lg" style={{ backgroundColor: "rgba(15, 23, 42, 0.04)" }} />
                      ) : null}
                      {items.length === 1 ? (
                        <div className="pointer-events-none relative z-[5]">
                          <Mini size="m" slotIdx={items[0].slotIdx} pc={items[0].pc} role={items[0].role} fret={fret} sIdx={sIdx} />
                        </div>
                      ) : items.length ? (
                        <div className="absolute inset-0 z-[5] pointer-events-none">
                          {items
                            .slice()
                            .sort((a, b) => a.slotIdx - b.slotIdx)
                            .slice(0, 4)
                            .map((it, i2) => {
                              const calibratedPos = calibratedClusterPos(items.length, i2);
                              const pos = calibratedPos || cornerStyle(items.length, i2);
                              const miniSize = items.length === 2 ? "pair" : calibratedPos ? "cal" : "s";
                              return (
                                <div key={`${it.slotIdx}-${it.role}-${i2}`} className="absolute" style={pos}>
                                  <Mini size={miniSize} slotIdx={it.slotIdx} pc={it.pc} role={it.role} fret={fret} sIdx={sIdx} />
                                </div>
                              );
                            })}
                        </div>
                      ) : (fret === 0 && !usedStrings.has(sIdx)) ? (
                        <span className="pointer-events-none relative z-[5] text-xs font-semibold text-slate-400">X</span>
                      ) : showNonScale ? (
                        <div className="pointer-events-none relative z-[1] text-[10px] text-slate-400">{labelForCellAt(sIdx, fret)}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>
      </section>
    );
  }

  function ClusterOverlapDebugPanel() {
    return (
      <section className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
        <div className="text-sm font-semibold text-slate-800">Prueba solape (traste 23)</div>
        <div className="mt-1 text-xs text-slate-600">Usa X, Y y tamaño para ajustar manualmente 4 círculos de prueba fuera del mástil.</div>

        <div className="mt-3 flex flex-wrap gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold text-slate-700">Vista previa</div>
            <div className="flex items-start gap-2">
              <div className="pt-7 text-[11px] font-semibold text-slate-600">23</div>
              <div className="relative h-8 w-[72px] rounded-lg border border-slate-200 bg-slate-50">
                {clusterTestDots.map((dot, idx) => (
                  <div
                    key={idx}
                    className="absolute rounded-full border-2 bg-white"
                    style={{
                      left: `${dot.x}px`,
                      top: `${dot.y}px`,
                      width: `${dot.size}px`,
                      height: `${dot.size}px`,
                      borderColor: dot.color,
                      transform: "translate(-50%, -50%)",
                    }}
                    title={`Círculo ${idx + 1}: x ${dot.x}, y ${dot.y}, tamaño ${dot.size}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid flex-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {clusterTestDots.map((dot, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-700">Círculo {idx + 1}</div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <label className={UI_LABEL_SM}>X</label>
                    <input
                      type="number"
                      className={UI_INPUT_SM + " mt-1 w-full"}
                      value={dot.x}
                      onChange={(e) => setClusterTestDot(idx, "x", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={UI_LABEL_SM}>Y</label>
                    <input
                      type="number"
                      className={UI_INPUT_SM + " mt-1 w-full"}
                      value={dot.y}
                      onChange={(e) => setClusterTestDot(idx, "y", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={UI_LABEL_SM}>Tamaño</label>
                    <input
                      type="number"
                      className={UI_INPUT_SM + " mt-1 w-full"}
                      value={dot.size}
                      onChange={(e) => setClusterTestDot(idx, "size", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // --------------------------------------------------------------------------
  // COMPONENTES UI INTERNOS: MÁSTILES PRINCIPALES
  // --------------------------------------------------------------------------

  function RouteLabFretboard() {
    return (
      <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-800">Ruta musical</div>
            <div className="text-xs text-slate-600">Ruta musical reescrita desde cero con criterio más tocable.</div>
          </div>

          <div className="text-xs text-slate-600">
            {routeLabResult.reason ? (
              <span className="font-semibold text-rose-600">{routeLabResult.reason}</span>
            ) : (
              <span>
                Ruta: {routeLabStartCode} {"\u2192"} {routeLabEndCode} | pasos: <b>{routeLabResult.path.length}</b>
              </span>
            )}
          </div>
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
            <React.Fragment key={st.label}>
              <div className="grid items-center gap-1" style={{ gridTemplateColumns: fretGridCols(maxFret) }}>
                <div className="text-xs font-medium text-slate-700">{st.label}</div>

                {Array.from({ length: maxFret + 1 }, (_, fret) => {
                  const pc = mod12(st.pc + fret);
                  const inScale = scalePcs.has(pc);
                  const inExtra = showExtra && extraPcs.has(pc);
                  const displayRole = getDisplayRole({ pc, inScale, inExtra });
                  const cellKey = `${sIdx}:${fret}`;
                  const routeIdx = routeLabIndexByCell.get(cellKey);
                  const inRoute = routeIdx != null;
                  const bgRoute = inRoute
                    ? {
                        backgroundImage: `linear-gradient(0deg, ${rgba(colors.route, 0.28)} 0%, ${rgba(colors.route, 0.28)} 100%)`,
                        boxShadow: `inset 0 0 0 2px ${rgba("#000000", 0.9)}`,
                      }
                    : {};
                  const shouldRender = inRoute || displayRole !== null || showNonScale;
                  const effectiveRole = displayRole ?? roleOfPc(pc);

                  return (
                    <div
                      key={`${sIdx}-${fret}`}
                      onClick={() => {
                        if (!inScale) return;
                        const code = `${sIdx + 1}${fret}`;
                        if (routeLabPickNext === "start") {
                          setRouteLabStartCode(code);
                          setRouteLabPickNext("end");
                        } else {
                          setRouteLabEndCode(code);
                          setRouteLabPickNext("start");
                        }
                      }}
                      className={`group relative isolate flex h-8 overflow-visible items-center justify-center rounded-lg border ${
                        fret === 0 ? "border-slate-300" : "border-slate-200"
                      } ${shouldRender && displayRole ? "z-[4]" : "z-0"} ${inScale ? "cursor-pointer hover:ring-2 hover:ring-slate-300" : ""}`}
                      style={{ backgroundColor: FRET_CELL_BG, ...bgRoute }}
                    >
                      {hasInlayCell(fret, sIdx) ? (
                        <div
                          className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2"
                          style={{ bottom: "-10px" }}
                        >
                          <div className="h-4 w-4 rounded-full bg-slate-300 opacity-95" />
                        </div>
                      ) : null}
                      <HoverCellNote sIdx={sIdx} fret={fret} visible={!shouldRender} />
                      {shouldRender && (inRoute || displayRole !== null) ? (
                        <Circle pc={pc} role={effectiveRole} fret={fret} sIdx={sIdx} badge={inRoute ? routeIdx : null} kingTags={[]} />
                      ) : showNonScale ? (
                        <div className="text-[10px] text-slate-400">{labelForPc(pc)}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>

        <div className="mt-3 space-y-1 text-xs text-slate-600">
          <div>
            Escala activa ({pcToName(rootPc, preferSharps)}): {scaleIntervals.map((i) => intervalToDegreeToken(i)).join(" – ")}
          </div>
          <div>
            Escala activa ({pcToName(rootPc, preferSharps)}): {spelledScaleNotes.join(" – ")}
          </div>
          {routeLabText ? (
            <>
              <div>
                <b>Ruta texto:</b> {routeLabText}
              </div>
              <div>
                <b>Coste total:</b> {routeLabResult.cost != null ? Number(routeLabResult.cost).toFixed(2) : "—"}
              </div>
              <details className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                <summary className="cursor-pointer font-semibold text-slate-700">Por qué eligió esta ruta</summary>
                <div className="mt-2 space-y-1 text-slate-600">
                  {routeLabDebugLines.length ? routeLabDebugLines.map((line, idx) => (
                    <div key={idx}>{line}</div>
                  )) : <div>Sin detalle disponible.</div>}
                </div>
              </details>
            </>
          ) : null}

    {routeStaffEvents.length ? (
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold text-slate-700">Pentagrama 4/4</div>
              <MusicStaff events={routeStaffEvents} preferSharps={preferSharps} clefMode="guitar" keySignature={routeKeySignature} />
            </div>
          ) : null}

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

  function Fretboard({ title, subtitle, mode }) {
    // mode: scale | patterns | route
    const showAllNotes = showNonScale;
    const usesKingOverlay = mode === "scale" && isKingBoxEligibleScale && showKingBoxes;

    return (
      <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-800">{title}</div>
            {subtitle ? <div className="text-xs text-slate-600">{subtitle}</div> : null}
          </div>

          {mode === "patterns" ? (
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-slate-700">Modo patrones:</div>
              <select
                className={UI_SELECT_SM + " w-44"}
                value={patternsMode}
                onChange={(e) => setPatternsMode(e.target.value)}
                title="Define el modo del mástil Patrones (Auto/Boxes/3NPS/CAGED)"
              >
                <option value="auto">Auto</option>
                {scaleIntervals.length === 5 ? <option value="boxes">Boxes (pentatónica)</option> : null}
                {scaleIntervals.length === 7 ? <option value="nps">3NPS</option> : null}
                <option value="caged">CAGED</option>
              </select>
            </div>
          ) : null}

          {mode === "route" ? (
            <div className="text-xs text-slate-600">
              {routeResult.reason ? (
                <span className="font-semibold text-rose-600">{routeResult.reason}</span>
              ) : (
                <span>
                  Ruta: {routeStartCode} {"\u2192"} {routeEndCode} | pasos: <b>{routeResult.path.length}</b>
                </span>
              )}
            </div>
          ) : null}
        </div>

        {/* Cabecera de trastes */}
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
            <React.Fragment key={st.label}>
              <div className="grid items-center gap-1" style={{ gridTemplateColumns: fretGridCols(maxFret) }}>
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
                        boxShadow: `inset 0 0 0 2px ${rgba("#000000", 0.9)}`,
                      }
                    : {};

                  const kingTags = usesKingOverlay ? Array.from(kingBoxOverlay.get(cellKey) || []) : [];
                  const effectiveRole = displayRole ?? (kingTags.length ? roleOfPc(pc) : null);
                  const shouldRender = effectiveRole !== null || showAllNotes || kingTags.length > 0;

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
                      className={`group relative isolate flex h-8 overflow-visible items-center justify-center rounded-lg border ${
                        fret === 0 ? "border-slate-300" : "border-slate-200"
                      } ${shouldRender && displayRole ? "z-[4]" : "z-0"} ${mode === "route" && inScale ? "cursor-pointer hover:ring-2 hover:ring-slate-300" : ""}`}
                      style={{ backgroundColor: FRET_CELL_BG, ...bgPat, ...bgRoute }}
                    >
                      {hasInlayCell(fret, sIdx) ? (
                        <div
                          className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2"
                          style={{ bottom: "-10px" }}
                        >
                          <div className="h-4 w-4 rounded-full bg-slate-300 opacity-95" />
                        </div>
                      ) : null}
                      <HoverCellNote sIdx={sIdx} fret={fret} visible={!shouldRender} />
                      {shouldRender && effectiveRole ? (
                        <Circle pc={pc} role={effectiveRole} fret={fret} sIdx={sIdx} badge={mode === "route" ? routeIdx : null} kingTags={kingTags} />
                      ) : showAllNotes ? (
                        <div className="text-[10px] text-slate-400">{labelForPc(pc)}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>

        <div className="mt-3 space-y-1 text-xs text-slate-600">
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

  // --------------------------------------------------------------------------
  // COMPONENTES UI INTERNOS: AYUDA / MANUAL
  // --------------------------------------------------------------------------

  function ManualOverlay() {
    if (!manualOpen) return null;

    return (
      <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-900/45 p-4">
        <div className="mt-8 max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Manual de uso</div>
              <div className="text-sm text-slate-600">Qué hace la página y cómo empezar sin conocerla.</div>
            </div>
            <button type="button" className={UI_BTN_SM + " w-auto px-3"} onClick={() => setManualOpen(false)}>
              Cerrar
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">Qué hace</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">
                Esta página muestra escalas, patrones, rutas sobre el mástil y acordes con digitaciones reales.
                Sirve para estudiar dónde están las notas, qué intervalos forman una escala, qué patrones encajan y qué acordes puedes tocar o investigar.
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">Flujo rápido</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div>1. Elige <b>Nota raíz</b> y <b>Escala</b>.</div>
                <div>2. Decide si quieres ver <b>Notas</b>, <b>Intervalos</b> o ambos.</div>
                <div>3. Activa los mástiles que necesites: <b>Escala</b>, <b>Patrones</b>, <b>Ruta</b> y <b>Acordes</b>.</div>
                <div>4. Ajusta <b>Trastes</b> para ampliar o reducir el rango visible.</div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">Mástil de escala</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div>Resalta raíz, 3ª, 5ª y resto de notas de la escala.</div>
                <div>Puedes activar <b>Notas extra</b> para añadir tensiones o notas ajenas.</div>
                <div><b>Ver todo</b> muestra también notas fuera de la escala.</div>
                <div>Al pasar el ratón por una celda vacía aparece la nota del traste.</div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">Patrones</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div>Permite ver patrones posicionales sobre la escala activa.</div>
                <div><b>Auto</b> decide el sistema adecuado según la escala.</div>
                <div>En pentatónicas usa <b>5 boxes</b>.</div>
                <div>En escalas de 7 notas usa <b>7 patrones 3NPS</b>.</div>
                <div>También puedes forzar <b>CAGED</b>.</div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">Ruta musical</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div>Calcula un recorrido entre una nota inicial y una final siguiendo la escala.</div>
                <div>Puedes escribir posiciones como <b>61</b> o elegirlas con clic en el mástil.</div>
                <div>La ruta musical actual usa el motor nuevo y busca llegar del inicio al fin de la forma más tocable posible.</div>
                <div>El límite de notas por cuerda es orientativo: intenta respetarlo, pero puede hacer slides o pequeños desplazamientos si eso mejora la digitación.</div>
                <div>Prioriza avanzar con lógica de guitarrista, evitando retrocesos absurdos de cuerda y favoreciendo trayectorias diagonales naturales.</div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">Acorde principal</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div>Construye acordes a partir de tono, calidad, estructura, forma, inversión y extensiones.</div>
                <div>La app busca voicings reales y los puedes recorrer con las flechas o el desplegable.</div>
                <div><b>Estudiar</b> abre un análisis del acorde, el voicing y sus tensiones.</div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">Investigar en mástil</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div>Al activar <b>Investigar en mástil</b>, el cuadro de acorde queda bloqueado y seleccionas notas directamente en el mástil.</div>
                <div>Solo puede haber una nota por cuerda. Si pulsas otra en la misma cuerda, sustituye a la anterior.</div>
                <div>La app propone lecturas posibles del acorde y puedes copiar una a la sección de arriba.</div>
                <div>Opcionalmente puedes activar sonido al pulsar y usar <b>Play</b> para oír la selección de grave a agudo.</div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">Acordes cercanos</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div>Permite comparar hasta 4 acordes en una misma zona del mástil.</div>
                <div>Busca digitaciones dentro de un rango de trastes y ordena por cercanía al acorde de referencia.</div>
                <div>Sirve para estudiar progresiones, voice leading y tonalidades posibles.</div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">Presets y configuración</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div><b>Presets rápidos</b> guardan y recuperan configuraciones habituales.</div>
                <div><b>Exportar config</b> guarda toda la configuración en un JSON.</div>
                <div><b>Importar config</b> recupera una configuración anterior.</div>
                <div><b>Restablecer</b> vuelve a los valores por defecto.</div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">Consejos</div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div>Empieza con una escala simple, por ejemplo mayor o pentatónica menor.</div>
                <div>Usa primero <b>Notas</b>; cuando ubiques bien el mástil, añade <b>Intervalos</b>.</div>
                <div>Para estudiar armonía, combina <b>Acorde principal</b>, <b>Estudiar</b> y <b>Acordes cercanos</b>.</div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // CONSTANTES DE UI Y LAYOUT
  // --------------------------------------------------------------------------

  const wrap = "mx-auto min-w-[1500px] max-w-[1500px] p-3";

  // UI compacto (especialmente para Acordes)
  const UI_SELECT_SM = "h-7 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs shadow-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";
  const UI_SELECT_SM_TONE = "h-7 w-[60px] rounded-xl border border-slate-200 bg-white px-1 text-xs shadow-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";
  const UI_SELECT_SM_AUTO = "h-7 rounded-xl border border-slate-200 bg-white px-2 text-xs shadow-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";
  const fnMaxLabelCh = (items, fallback = 8) => {
    const maxLen = (items || []).reduce((acc, item) => {
      const label = typeof item === "string" ? item : (item?.label ?? item?.value ?? "");
      return Math.max(acc, String(label).length);
    }, fallback);
    return `${Math.max(maxLen + 3, fallback)}ch`;
  };
  const chordFamilySelectWidth = fnMaxLabelCh(CHORD_FAMILIES, 10);
  const chordQualitySelectWidth = fnMaxLabelCh(CHORD_QUALITIES, 10);
  const chordSuspensionSelectWidth = fnMaxLabelCh(["Sus —", "sus2", "sus4"], 8);
  const chordFormSelectWidth = fnMaxLabelCh(CHORD_FORMS, 10);
  const chordInversionSelectWidth = fnMaxLabelCh(CHORD_INVERSIONS, 10);
  const UI_BTN_SM = "h-7 w-7 rounded-xl border border-slate-200 bg-white text-xs font-semibold shadow-sm hover:bg-slate-100 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed";
  const UI_INPUT_SM = "h-7 rounded-xl border border-slate-200 bg-white px-2 text-xs shadow-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";
  const UI_LABEL_SM = "block text-[11px] font-semibold text-slate-700";
  const UI_HELP_SM = "text-[11px] text-slate-500";
  const UI_EXT_GRID = "mt-1 grid grid-cols-3 gap-x-3 gap-y-1 text-xs";

  // Estado visual de b/# (solo para acordes): si la tónica es nota negra, resaltamos b o # según la ortografía.
  const chordAccidental = !NATURAL_PCS.has(mod12(chordRootPc));

  const scaleOptions = useMemo(
    () => Object.keys(SCALE_PRESETS).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    []
  );

  return (
    <div className="min-h-screen overflow-x-auto bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <div ref={appRootRef} className={wrap}>
        <header className="mb-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">Mástil interactivo: escalas, patrones, rutas y acordes</h1>
            <span className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">ver. {APP_VERSION}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Presets rápidos</span>
              {Array.from({ length: QUICK_PRESET_COUNT }, (_, i) => (
                <div key={i} className="flex items-center gap-1">
                  <button
                    type="button"
                    className={UI_BTN_SM + " w-auto px-3"}
                    onClick={() => loadQuickPreset(i)}
                    disabled={!quickPresets[i]}
                    title={quickPresets[i]?.savedAt ? `${quickPresets[i]?.name} · ${quickPresets[i]?.savedAt}` : `Preset ${i + 1} vacío`}
                  >
                    {quickPresets[i]?.name || `Preset ${i + 1}`}
                  </button>
                  <button
                    type="button"
                    className={UI_BTN_SM + " w-auto px-2"}
                    onClick={() => saveQuickPreset(i)}
                    title={`Guardar configuración actual en Preset ${i + 1}`}
                  >
                    Guardar
                  </button>
                </div>
              ))}
            </div>

            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <button type="button" className={UI_BTN_SM + " w-auto px-3"} onClick={() => setManualOpen(true)}>
                Manual
              </button>
              <button type="button" className={UI_BTN_SM + " w-auto px-3"} onClick={exportUiConfig}>
                Exportar config
              </button>
              <button
                type="button"
                className={UI_BTN_SM + " w-auto px-3"}
                onClick={() => importConfigInputRef.current && importConfigInputRef.current.click()}
              >
                Importar config
              </button>
              <button type="button" className={UI_BTN_SM + " w-auto px-3"} onClick={resetUiConfig}>
                Restablecer
              </button>
              <input
                ref={importConfigInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  importUiConfigFromFile(e.target.files && e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          {configNotice ? (
            <div
              className={`mt-2 rounded-xl border px-3 py-2 text-sm ${configNotice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : configNotice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-sky-200 bg-sky-50 text-sky-700"}`}
            >
              {configNotice.text}
            </div>
          ) : null}
        </header>

        <div className="grid gap-3 grid-cols-[1fr_190px]">
          {/* IZQUIERDA */}
          <div className="space-y-4">
            {/* CONFIG ESCALAS */}
            <section className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
              {/* fila 1: tónica · notación · escala · vista · trastes */}
              <div className="flex flex-wrap items-end gap-3">
                {/* Nota raíz */}
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className={UI_LABEL_SM}>Nota raíz</label>
                    <div className="mt-1 flex items-center gap-1.5">
                      <select
                        className={UI_SELECT_SM_TONE}
                        value={scaleRootLetter}
                        onChange={(e) => {
                          const letter = e.target.value;
                          if (!Object.prototype.hasOwnProperty.call(NATURAL_PC, letter)) return;
                          setScaleRootLetter(letter);
                          setScaleRootAcc(null);
                          setRootPc(mod12(NATURAL_PC[letter]));
                        }}
                        title="Tónica (letra)"
                      >
                        {LETTERS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className={`${UI_BTN_SM} ${scaleRootAcc === "flat" ? "!bg-slate-900 !text-white !border-slate-900" : ""}`}
                        title="Bajar 1 semitono (b). Si ya está alterado, vuelve a natural."
                        onClick={() => {
                          const nat = mod12(NATURAL_PC[scaleRootLetter]);
                          if (scaleRootAcc === "flat") {
                            setScaleRootAcc(null);
                            setRootPc(nat);
                            return;
                          }
                          setScaleRootAcc("flat");
                          setRootPc(mod12(nat - 1));
                        }}
                      >
                        b
                      </button>

                      <button
                        type="button"
                        className={`${UI_BTN_SM} ${scaleRootAcc === "sharp" ? "!bg-slate-900 !text-white !border-slate-900" : ""}`}
                        title="Subir 1 semitono (#). Si ya está alterado, vuelve a natural."
                        onClick={() => {
                          const nat = mod12(NATURAL_PC[scaleRootLetter]);
                          if (scaleRootAcc === "sharp") {
                            setScaleRootAcc(null);
                            setRootPc(nat);
                            return;
                          }
                          setScaleRootAcc("sharp");
                          setRootPc(mod12(nat + 1));
                        }}
                      >
                        #
                      </button>
                    </div>
                  </div>

                  {/* Notación */}
                  <div>
                    <div className={UI_LABEL_SM}>Notación</div>
                    <div className="mt-1 flex gap-1.5">
                      <ToggleButton
                        active={accMode === "auto"}
                        onClick={() => setAccMode("auto")}
                        title="Auto usa la armadura esperada; por ejemplo, en F mayor usa Bb, no A#."
                      >
                        Auto
                      </ToggleButton>
                      <ToggleButton active={accMode === "sharps"} onClick={() => setAccMode("sharps")} title="Forzar sostenidos">
                        #
                      </ToggleButton>
                      <ToggleButton active={accMode === "flats"} onClick={() => setAccMode("flats")} title="Forzar bemoles">
                        b
                      </ToggleButton>
                    </div>
                  </div>
                </div>

                {/* Escala */}
                <div className="min-w-[260px] flex-1">
                  <label className={UI_LABEL_SM}>Escala</label>
                  <select
                    className={UI_SELECT_SM + " mt-1"}
                    value={scaleName}
                    onChange={(e) => setScaleName(e.target.value)}
                    title="Selecciona una escala/preset"
                  >
                    {scaleOptions.map((s) => (
                      <option key={s} value={s}>
                        {scaleOptionLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vista */}
                <div>
                  <div className={UI_LABEL_SM}>Vista</div>
                  <div className="mt-1 flex gap-1.5">
                    <ToggleButton active={showNotesLabel} onClick={() => setShowNotesLabel((v) => !v)} title="Muestra nombre de la nota">
                      Notas
                    </ToggleButton>
                    <ToggleButton active={showIntervalsLabel} onClick={() => setShowIntervalsLabel((v) => !v)} title="Muestra grado/intervalo">
                      Intervalos
                    </ToggleButton>
                  </div>
                </div>

                {/* Trastes */}
                <div className="min-w-[130px]">
                  <label className={UI_LABEL_SM}>Trastes</label>
                  <select
                    className={UI_SELECT_SM + " mt-1"}
                    value={maxFret}
                    onChange={(e) => setMaxFret(parseInt(e.target.value, 10))}
                    title="Rango de trastes"
                  >
                    {[12, 15, 18, 21, 24].map((n) => (
                      <option key={n} value={n}>
                        0–{n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* fila 2: personalizada · extras · mástiles */}
              {scaleName === "Personalizada" ? (
                <div className="mt-2">
                  <div className={UI_LABEL_SM}>Intervalos personalizados</div>
                  <input
                    className={UI_INPUT_SM + " mt-1 w-full"}
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Ej: 1 b3 5 6"
                    title="Introduce intervalos (1–7 con b/#), notas (F, Ab, C#) o semitonos (s3)"
                  />
                </div>
              ) : null}

              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[420px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={UI_LABEL_SM}>Armonización</div>
                    <select
                      className={UI_SELECT_SM + " w-44"}
                      value={harmonyMode}
                      onChange={(e) => setHarmonyMode(e.target.value)}
                      title="Define si la armonización es diatónica o funcional menor (V7 en escalas menores)"
                    >
                      <option value="diatonic">Diatónica</option>
                      <option value="functional_minor">Funcional menor (V7)</option>
                    </select>
                  </div>
                  <div className="mt-1 text-xs text-slate-600"><b>Grados:</b> {scaleTetradDegreesText}</div>
                  <div className="mt-0.5 text-xs text-slate-600"><b>Notas:</b> {scaleTetradNotesText}</div>
                </div>

                <div className="min-w-[220px]">
                  <div className={UI_LABEL_SM}>Notas extra</div>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      className={UI_INPUT_SM + " w-28"}
                      value={extraInput}
                      onChange={(e) => setExtraInput(e.target.value)}
                      placeholder="Ej: b2"
                      title="Notas/intervalos a resaltar como extra"
                    />
                    <ToggleButton active={showExtra} onClick={() => setShowExtra((v) => !v)} title="Activa/desactiva las notas extra">
                      {showExtra ? "Extra ON" : "Extra OFF"}
                    </ToggleButton>
                    <ToggleButton active={showNonScale} onClick={() => setShowNonScale((v) => !v)} title="Muestra todas las notas (no solo escala)">
                      Ver todo
                    </ToggleButton>
                  </div>
                </div>

                <div className="min-w-[220px]">
                  <div className={UI_LABEL_SM}>Mástiles</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <ToggleButton active={showBoards.scale} onClick={() => setShowBoards((s) => ({ ...s, scale: !s.scale }))} title="Muestra el mástil de la escala">
                      Escala
                    </ToggleButton>
                    <ToggleButton active={showBoards.patterns} onClick={() => setShowBoards((s) => ({ ...s, patterns: !s.patterns }))} title="Muestra el mástil de patrones">
                      Patrones
                    </ToggleButton>
                    <ToggleButton active={showBoards.route} onClick={() => setShowBoards((s) => ({ ...s, route: !s.route }))} title="Muestra el mástil de ruta">
                      Ruta
                    </ToggleButton>
                    <ToggleButton active={showBoards.chords} onClick={() => setShowBoards((s) => ({ ...s, chords: !s.chords }))} title="Muestra el panel de acordes">
                      Acordes
                    </ToggleButton>
                  </div>
                </div>
              </div>

              {isKingBoxEligibleScale ? (
                <div className="mt-2">
                  <div className="min-w-[760px]">
                    <div className={UI_LABEL_SM}>Casitas blues</div>
                    <div className="mt-1 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700">
                      <label className="inline-flex items-center gap-2 font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={showKingBoxes}
                          onChange={(e) => setShowKingBoxes(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Mostrar
                      </label>
                      <select
                        className={UI_SELECT_SM.replace("w-full", "") + " w-40"}
                        value={kingBoxMode}
                        onChange={(e) => setKingBoxMode(e.target.value)}
                        disabled={!showKingBoxes}
                        title="Elige la casita a resaltar"
                      >
                        <option value="bb">B.B. King</option>
                        <option value="albert">Albert King</option>
                        <option value="both">Ambas</option>
                      </select>
                      <label className="inline-flex items-center gap-2">
                        <span>{KING_BOX_DEFAULTS.bb.label}</span>
                        <input
                          type="color"
                          value={kingBoxColors.bb}
                          onChange={(e) => setKingBoxColors((prev) => ({ ...prev, bb: e.target.value }))}
                          className="h-7 w-10 cursor-pointer rounded-md border border-slate-200 bg-white"
                          title="Color del borde de B.B. King"
                        />
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <span>{KING_BOX_DEFAULTS.albert.label}</span>
                        <input
                          type="color"
                          value={kingBoxColors.albert}
                          onChange={(e) => setKingBoxColors((prev) => ({ ...prev, albert: e.target.value }))}
                          className="h-7 w-10 cursor-pointer rounded-md border border-slate-200 bg-white"
                          title="Color del borde de Albert King"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            {/* MÁSTILES */}
            <div className="space-y-3">
              {showBoards.scale ? <Fretboard title="Escala" subtitle="Escala + (opcional) extras. Resalta raíz/3ª/5ª." mode="scale" /> : null}
              {showBoards.patterns ? <Fretboard title="Patrones" subtitle="Patrones: 5 boxes (pentatónicas), 7 3NPS (7 notas) y CAGED. Ruta: sigue la escala en orden y se restringe a patrones." mode="patterns" /> : null}
              {showBoards.route ? (
                <>
                  <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                    <div className="text-sm font-semibold text-slate-800">Ruta musical</div>
                    <div className="mt-2 grid gap-2 grid-cols-[150px_150px_220px]">
                      <div>
                        <label className={UI_LABEL_SM}>Inicio</label>
                        <input className={UI_INPUT_SM + " mt-1 w-full"} value={routeLabStartCode} onChange={(e) => setRouteLabStartCode(e.target.value)} />
                      </div>
                      <div>
                        <label className={UI_LABEL_SM}>Fin</label>
                        <input className={UI_INPUT_SM + " mt-1 w-full"} value={routeLabEndCode} onChange={(e) => setRouteLabEndCode(e.target.value)} />
                      </div>
                      <div>
                        <label className={UI_LABEL_SM}>Máx. notas seguidas/cuerda</label>
                        <select className={UI_SELECT_SM + " mt-1"} value={routeLabMaxPerString} onChange={(e) => setRouteLabMaxPerString(parseInt(e.target.value, 10))}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500">Click en el mástil de ruta para elegir: {routeLabPickNext === "start" ? "Inicio" : "Fin"}.</div>
                  </section>

                  <RouteLabFretboard />
                </>
              ) : null}

              {showBoards.chords ? (
                <div className="space-y-3">
                  {/* ACORDES (principal) */}
                  <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-800">Acordes</div>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={chordDetectMode}
                          onChange={(e) => setChordDetectMode(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Investigar en mástil
                      </label>
                    </div>
                    <fieldset disabled={chordDetectMode} className={`mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 ${chordDetectMode ? "opacity-70" : ""}`}>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">
                            Acorde
                            <span className="ml-2 text-xs font-semibold text-slate-800">
                              {chordFamily === "quartal"
                                ? chordQuartalDisplayName
                                : chordFamily === "guide_tones"
                                  ? `${guideToneDisplayName} · Notas guía`
                                  : chordBaseDisplayName}
                            </span>
                          </div>
                          {chordFamily === "quartal" ? (
                            <>
                              <div className="mt-1">
                                <ChordNoteBadgeStrip items={chordQuartalBadgeItems} bassNote={chordQuartalBassNote} colorMap={colors} />
                              </div>
                              
                            </>
                          ) : chordFamily === "guide_tones" ? (
                            <>
                              <div className="mt-1">
                                <ChordNoteBadgeStrip items={guideToneBadgeItems} bassNote={guideToneBassNote} colorMap={colors} />
                              </div>
                            </>
                          ) : (
                            <div className="mt-1">
                              <ChordNoteBadgeStrip items={chordHeaderBadgeItems} bassNote={chordHeaderBassNote} colorMap={colors} />
                            </div>
                          )}
                        </div>
                        {chordFamily === "tertian" ? (
                          <div className="flex items-center gap-2">
                            <label
                              className="ml-[200px] inline-flex h-7 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                              title="Permite usar cuerdas al aire como opción de voicing. La distancia se calcula solo con las notas pisadas."
                            >
                              <span>Permitir cuerdas al aire</span>
                              <input
                                type="checkbox"
                                checked={chordAllowOpenStrings}
                                onChange={(e) => {
                                  setChordAllowOpenStrings(e.target.checked);
                                  setChordSelectedFrets(null);
                                  setChordVoicingIdx(0);
                                }}
                                title="Permite usar cuerdas al aire como opción de voicing. La distancia se calcula solo con las notas pisadas."
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </label>
                            <button
                              type="button"
                              className={UI_BTN_SM + " w-auto px-3"}
                              title="Abre el análisis del acorde, del voicing y de sus tensiones."
                              onClick={() => {
                                setStudyTarget("main");
                                setStudyOpen(true);
                              }}
                            >
                              Estudiar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <label
                              className="inline-flex h-7 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                              title={chordFamily === "quartal" ? "Incluye cuerdas al aire en la búsqueda de voicings cuartales." : "Incluye cuerdas al aire en la búsqueda de shells de notas guía."}
                            >
                              <span>Permitir cuerdas al aire</span>
                              <input
                                type="checkbox"
                                checked={chordAllowOpenStrings}
                                onChange={(e) => {
                                  setChordAllowOpenStrings(e.target.checked);
                                  if (chordFamily === "quartal") {
                                    setChordQuartalSelectedFrets(null);
                                    setChordQuartalVoicingIdx(0);
                                  } else {
                                    setGuideToneSelectedFrets(null);
                                    setGuideToneVoicingIdx(0);
                                  }
                                }}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </label>
                            <button
                              type="button"
                              className={UI_BTN_SM + " w-auto px-3"}
                              title="Abre el análisis del acorde, del voicing y de sus tensiones."
                              onClick={() => {
                                setStudyTarget("main");
                                setStudyOpen(true);
                              }}
                            >
                              Estudiar
                            </button>
                          </div>
                        )}
                      </div>
                      {chordFamily === "quartal" ? (
                        <div className="grid items-stretch gap-2 grid-cols-[96px_118px_110px_118px_90px_82px_118px_minmax(0,1fr)_44px]">
                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Tono</label>
                          <div className="mt-1 flex items-center gap-1.5">
                            <select
                              className={UI_SELECT_SM_TONE}
                              value={chordUiLetterFromPc(chordRootPc, !!chordSpellPreferSharps)}
                              onChange={(e) => {
                                const letter = e.target.value;
                                if (Object.prototype.hasOwnProperty.call(NATURAL_PC, letter)) {
                                  setChordRootPc(mod12(NATURAL_PC[letter]));
                                }
                              }}
                            >
                              {LETTERS.map((l) => (
                                <option key={l} value={l}>
                                  {l}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className={`${UI_BTN_SM} ${chordAccidental && !chordSpellPreferSharps ? "!bg-slate-900 !text-white !border-slate-900" : ""}`}
                              title="Bajar 1 semitono"
                              onClick={() => {
                                const letter = chordUiLetterFromPc(chordRootPc, false);
                                const nat = mod12(NATURAL_PC[letter]);
                                const cur = mod12(chordRootPc);
                                if (cur !== nat) {
                                  setChordRootPc(nat);
                                  setChordSpellPreferSharps(false);
                                  return;
                                }
                                setChordRootPc(mod12(nat - 1));
                                setChordSpellPreferSharps(false);
                              }}
                            >
                              b
                            </button>
                            <button
                              type="button"
                              className={`${UI_BTN_SM} ${chordAccidental && chordSpellPreferSharps ? "!bg-slate-900 !text-white !border-slate-900" : ""}`}
                              title="Subir 1 semitono"
                              onClick={() => {
                                const letter = chordUiLetterFromPc(chordRootPc, true);
                                const nat = mod12(NATURAL_PC[letter]);
                                const cur = mod12(chordRootPc);
                                if (cur !== nat) {
                                  setChordRootPc(nat);
                                  setChordSpellPreferSharps(true);
                                  return;
                                }
                                setChordRootPc(mod12(nat + 1));
                                setChordSpellPreferSharps(true);
                              }}
                            >
                              #
                            </button>
                          </div>
                          
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Familia</label>
                          <select className={UI_SELECT_SM_AUTO + " mt-1"} style={{ width: chordFamilySelectWidth }} value={chordFamily} onChange={(e) => setChordFamily(e.target.value)}>
                            {CHORD_FAMILIES.map((item) => (
                              <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                          </select>
                        </div>
                        {chordQuartalReference === "scale" ? (
                          <div className="min-w-0">
                            <label className={UI_LABEL_SM}>Escala</label>
                            <select
                              className={UI_SELECT_SM + " mt-1"}
                              value={chordQuartalScaleName}
                              onChange={(e) => setChordQuartalScaleName(e.target.value)}
                              title="Escala usada para generar los cuartales diatónicos"
                            >
                              {CHORD_QUARTAL_SCALE_NAMES.map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="min-w-0" />
                        )}

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM} title={`Desde raíz: construye el acorde cuartal partiendo de la tónica elegida.
Diatónico a escala: toma la tónica elegida como centro tonal y genera acordes cuartales por grados de la escala que selecciones.
Por eso el resultado puede no tener la misma raíz elegida.`}>Referencia</label>
                          <select className={UI_SELECT_SM + " mt-1"} value={chordQuartalReference} onChange={(e) => setChordQuartalReference(e.target.value)} title={`Desde raíz: construye el acorde cuartal partiendo de la tónica elegida.
Diatónico a escala: toma la tónica elegida como centro tonal y genera acordes cuartales por grados de la escala que selecciones.
Por eso el resultado puede no tener la misma raíz elegida.`}>
                            {CHORD_QUARTAL_REFERENCES.map((item) => (
                              <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM} title={`Cerrado: las voces quedan apiladas por cuartas sin desplazar ninguna una octava extra.
Abierto: una o más voces se redistribuyen por octava y la cadena deja de quedar compacta.`}>Apilado</label>
                          <select className={UI_SELECT_SM + " mt-1"} value={chordQuartalSpread} onChange={(e) => setChordQuartalSpread(e.target.value)} title={`Cerrado: las voces quedan apiladas por cuartas sin desplazar ninguna una octava extra.
Abierto: una o más voces se redistribuyen por octava y la cadena deja de quedar compacta.`}>
                            {CHORD_QUARTAL_SPREADS.map((item) => (
                              <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Voces</label>
                          <select className={UI_SELECT_SM + " mt-1"} value={chordQuartalVoices} onChange={(e) => setChordQuartalVoices(e.target.value)}>
                            {CHORD_QUARTAL_VOICES.map((item) => (
                              <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM} title={`Puro: todas las cuartas son justas (4J).
Mixto: combina 4J y al menos una 4ª aumentada (A4), así que no es puro.`}>Tipo cuartal</label>
                          <select className={UI_SELECT_SM + " mt-1"} value={chordQuartalType} onChange={(e) => setChordQuartalType(e.target.value)} title={`Puro: todas las cuartas son justas (4J).
Mixto: combina 4J y al menos una 4ª aumentada (A4), así que no es puro.`}>
                            {CHORD_QUARTAL_TYPES.map((item) => (
                              <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Voicing ({chordQuartalVoicings.length} opciones)</label>
                          <div className="mt-1 flex items-center gap-1.5">
                            <button
                              type="button"
                              className={UI_BTN_SM}
                              title="Anterior"
                              onClick={() => {
                                if (!chordQuartalVoicings.length) return;
                                const vNextIdx = (chordQuartalVoicingIdx - 1 + chordQuartalVoicings.length) % chordQuartalVoicings.length;
                                setChordQuartalVoicingIdx(vNextIdx);
                                setChordQuartalSelectedFrets(chordQuartalVoicings[vNextIdx]?.frets ?? null);
                              }}
                              disabled={!chordQuartalVoicings.length}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>

                            <select
                              className={UI_SELECT_SM + " min-w-0 flex-1"}
                              value={chordQuartalSelectedFrets || chordQuartalVoicings[chordQuartalVoicingIdx]?.frets || ""}
                              onChange={(e) => {
                                const vFrets = e.target.value;
                                const vIdx = chordQuartalVoicings.findIndex((v) => v.frets === vFrets);
                                if (vIdx >= 0) {
                                  setChordQuartalVoicingIdx(vIdx);
                                  setChordQuartalSelectedFrets(vFrets);
                                }
                              }}
                              disabled={!chordQuartalVoicings.length}
                            >
                              {chordQuartalVoicings.map((v, i) => (
                                <option key={`${v.frets}-${i}`} value={v.frets}>
                                  {`${i + 1}. ${v.frets}${v.quartalDegree != null ? ` · ${fnBuildQuartalDegreeLabel(v.quartalDegree)}` : ""} (dist ${v.reach ?? (v.span + 1)})`}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              className={UI_BTN_SM}
                              title="Siguiente"
                              onClick={() => {
                                if (!chordQuartalVoicings.length) return;
                                const vNextIdx = (chordQuartalVoicingIdx + 1) % chordQuartalVoicings.length;
                                setChordQuartalVoicingIdx(vNextIdx);
                                setChordQuartalSelectedFrets(chordQuartalVoicings[vNextIdx]?.frets ?? null);
                              }}
                              disabled={!chordQuartalVoicings.length}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="min-w-0 w-[44px]">
                          <label className={UI_LABEL_SM}>Dist</label>
                          <select className={UI_SELECT_SM + " mt-1 w-[44px] px-1 text-center"} value={chordMaxDist} onChange={(e) => setChordMaxDist(parseInt(e.target.value, 10))}>
                            {[4, 5, 6].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      ) : chordFamily === "guide_tones" ? (
                        <div className="grid items-stretch gap-2 grid-cols-[96px_130px_130px_130px_130px_240px_56px]">
                          <div className="min-w-0">
                            <label className={UI_LABEL_SM}>Tono</label>
                            <div className="mt-1 flex items-center gap-1.5">
                              <select
                                className={UI_SELECT_SM_TONE}
                                value={chordUiLetterFromPc(chordRootPc, !!chordSpellPreferSharps)}
                                onChange={(e) => {
                                  const letter = e.target.value;
                                  if (Object.prototype.hasOwnProperty.call(NATURAL_PC, letter)) {
                                    setChordRootPc(mod12(NATURAL_PC[letter]));
                                  }
                                }}
                              >
                                {LETTERS.map((l) => (
                                  <option key={l} value={l}>{l}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className={`${UI_BTN_SM} ${chordAccidental && !chordSpellPreferSharps ? "!bg-slate-900 !text-white !border-slate-900" : ""}`}
                                title="Bajar 1 semitono"
                                onClick={() => {
                                  const letter = chordUiLetterFromPc(chordRootPc, false);
                                  const nat = mod12(NATURAL_PC[letter]);
                                  const cur = mod12(chordRootPc);
                                  if (cur !== nat) {
                                    setChordRootPc(nat);
                                    setChordSpellPreferSharps(false);
                                    return;
                                  }
                                  setChordRootPc(mod12(nat - 1));
                                  setChordSpellPreferSharps(false);
                                }}
                              >b</button>
                              <button
                                type="button"
                                className={`${UI_BTN_SM} ${chordAccidental && chordSpellPreferSharps ? "!bg-slate-900 !text-white !border-slate-900" : ""}`}
                                title="Subir 1 semitono"
                                onClick={() => {
                                  const letter = chordUiLetterFromPc(chordRootPc, true);
                                  const nat = mod12(NATURAL_PC[letter]);
                                  const cur = mod12(chordRootPc);
                                  if (cur !== nat) {
                                    setChordRootPc(nat);
                                    setChordSpellPreferSharps(true);
                                    return;
                                  }
                                  setChordRootPc(mod12(nat + 1));
                                  setChordSpellPreferSharps(true);
                                }}
                              >#</button>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <label className={UI_LABEL_SM}>Familia</label>
                            <select className={UI_SELECT_SM + " mt-1"} value={chordFamily} onChange={(e) => setChordFamily(e.target.value)}>
                              {CHORD_FAMILIES.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="min-w-0">
                            <label className={UI_LABEL_SM}>Calidad</label>
                            <select className={UI_SELECT_SM + " mt-1"} value={guideToneQuality} onChange={(e) => setGuideToneQuality(e.target.value)}>
                              {CHORD_GUIDE_TONE_QUALITIES.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="min-w-0">
                            <label className={UI_LABEL_SM}>Forma</label>
                            <select className={UI_SELECT_SM + " mt-1"} value={guideToneForm} onChange={(e) => setGuideToneForm(e.target.value)}>
                              {CHORD_GUIDE_TONE_FORMS.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="min-w-0">
                            <label className={UI_LABEL_SM}>Inversión</label>
                            <select className={UI_SELECT_SM + " mt-1"} value={guideToneInversion} onChange={(e) => setGuideToneInversion(e.target.value)}>
                              {CHORD_GUIDE_TONE_INVERSIONS.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="min-w-0">
                            <label className={UI_LABEL_SM}>Voicing ({guideToneVoicings.length} opciones)</label>
                            <div className="mt-1 flex items-center gap-1.5">
                              <button
                                type="button"
                                className={UI_BTN_SM}
                                title="Anterior"
                                onClick={() => {
                                  if (!guideToneVoicings.length) return;
                                  const nextIdx = (guideToneVoicingIdx - 1 + guideToneVoicings.length) % guideToneVoicings.length;
                                  setGuideToneVoicingIdx(nextIdx);
                                  setGuideToneSelectedFrets(guideToneVoicings[nextIdx]?.frets ?? null);
                                }}
                                disabled={!guideToneVoicings.length}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>

                              <select
                                className={UI_SELECT_SM + " min-w-0 flex-1 max-w-[170px]"}
                                value={guideToneSelectedFrets || guideToneVoicings[guideToneVoicingIdx]?.frets || ""}
                                onChange={(e) => {
                                  const vFrets = e.target.value;
                                  const vIdx = guideToneVoicings.findIndex((v) => v.frets === vFrets);
                                  if (vIdx >= 0) {
                                    setGuideToneVoicingIdx(vIdx);
                                    setGuideToneSelectedFrets(vFrets);
                                  }
                                }}
                                disabled={!guideToneVoicings.length}
                              >
                                {guideToneVoicings.map((v, i) => (
                                  <option key={`${v.frets}-${i}`} value={v.frets}>
                                    {`${i + 1}. ${v.frets} (dist ${v.reach ?? (v.span + 1)})`}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                className={UI_BTN_SM}
                                title="Siguiente"
                                onClick={() => {
                                  if (!guideToneVoicings.length) return;
                                  const nextIdx = (guideToneVoicingIdx + 1) % guideToneVoicings.length;
                                  setGuideToneVoicingIdx(nextIdx);
                                  setGuideToneSelectedFrets(guideToneVoicings[nextIdx]?.frets ?? null);
                                }}
                                disabled={!guideToneVoicings.length}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <label className={UI_LABEL_SM}>Dist.</label>
                            <select className={UI_SELECT_SM + " mt-1 w-full"} value={chordMaxDist} onChange={(e) => setChordMaxDist(parseInt(e.target.value, 10))}>
                              {[4, 5, 6].map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="grid items-stretch gap-2"
                          style={{
                            gridTemplateColumns: `96px ${chordFamilySelectWidth} max-content 90px ${chordFormSelectWidth} ${chordInversionSelectWidth} 130px 220px 56px`,
                          }}
                        >
                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Tono</label>
                          <div className="mt-1 flex items-center gap-1.5">
                            <select
                              className={UI_SELECT_SM_TONE}
                              value={chordUiLetterFromPc(chordRootPc, !!chordSpellPreferSharps)}
                              onChange={(e) => {
                                const letter = e.target.value;
                                if (Object.prototype.hasOwnProperty.call(NATURAL_PC, letter)) {
                                  setChordRootPc(mod12(NATURAL_PC[letter]));
                                }
                              }}
                            >
                              {LETTERS.map((l) => (
                                <option key={l} value={l}>{l}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className={`${UI_BTN_SM} ${chordAccidental && !chordSpellPreferSharps ? "!bg-slate-900 !text-white !border-slate-900" : ""}`}
                              title="Bajar 1 semitono"
                              onClick={() => {
                                const letter = chordUiLetterFromPc(chordRootPc, false);
                                const nat = mod12(NATURAL_PC[letter]);
                                const cur = mod12(chordRootPc);
                                if (cur !== nat) {
                                  setChordRootPc(nat);
                                  setChordSpellPreferSharps(false);
                                  return;
                                }
                                setChordRootPc(mod12(nat - 1));
                                setChordSpellPreferSharps(false);
                              }}
                            >
                              b
                            </button>
                            <button
                              type="button"
                              className={`${UI_BTN_SM} ${chordAccidental && chordSpellPreferSharps ? "!bg-slate-900 !text-white !border-slate-900" : ""}`}
                              title="Subir 1 semitono"
                              onClick={() => {
                                const letter = chordUiLetterFromPc(chordRootPc, true);
                                const nat = mod12(NATURAL_PC[letter]);
                                const cur = mod12(chordRootPc);
                                if (cur !== nat) {
                                  setChordRootPc(nat);
                                  setChordSpellPreferSharps(true);
                                  return;
                                }
                                setChordRootPc(mod12(nat + 1));
                                setChordSpellPreferSharps(true);
                              }}
                            >
                              #
                            </button>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Familia</label>
                          <select className={UI_SELECT_SM + " mt-1"} value={chordFamily} onChange={(e) => setChordFamily(e.target.value)}>
                            {CHORD_FAMILIES.map((item) => (
                              <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Calidad / Sus</label>
                          <div className="mt-1 flex flex-nowrap gap-1.5">
                            <select className={UI_SELECT_SM_AUTO} style={{ width: chordQualitySelectWidth }} value={chordQuality} onChange={(e) => setChordQuality(e.target.value)}>
                              {CHORD_QUALITIES.map((q) => (
                                <option key={q.value} value={q.value}
                                  disabled={
                                    (q.value === "hdim" && chordStructure === "triad" && !chordExt7) ||
                                    (q.value === "dom" && chordStructure === "triad" && !chordExt7)
                                  }
                                >
                                  {q.label}
                                </option>
                              ))}
                            </select>
                            <select
                              className={UI_SELECT_SM_AUTO}
                              style={{ width: chordSuspensionSelectWidth }}
                              value={chordSuspension}
                              onChange={(e) => {
                                const v = e.target.value;
                                setChordSuspension(v);
                                if (v !== "none" && (chordQuality === "dim" || chordQuality === "hdim")) setChordQuality("maj");
                              }}
                              title="Suspensión: reemplaza la 3ª por 2ª o 4ª"
                            >
                              <option value="none">Sus —</option>
                              <option value="sus2">sus2</option>
                              <option value="sus4">sus4</option>
                            </select>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Estructura</label>
                          <select
                            className={UI_SELECT_SM + " mt-1"}
                            value={chordStructure}
                            onChange={(e) => {
                              const val = e.target.value;
                              setChordStructure(val);
                              if (val === "triad") {
                                setChordExt6(false);
                                setChordExt7(false);
                                setChordExt9(false);
                                setChordExt11(false);
                                setChordExt13(false);
                              }
                              if (val === "triad" || val === "tetrad") {
                                setChordInversion("all");
                                setChordPositionForm("open");
                                setChordForm("open");
                              }
                            }}
                          >
                            {CHORD_STRUCTURES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Forma</label>
                          {chordEnginePlan.ui.usesManualForm ? (
                            <select
                              className={UI_SELECT_SM_AUTO + " mt-1"}
                              style={{ width: chordFormSelectWidth }}
                              value={chordForm}
                              onChange={(e) => {
                                const v = e.target.value;
                                setChordForm(v);
                                if (!isDropForm(v)) setChordPositionForm(v);
                              }}
                              title="Elige la disposición del acorde: cerrado, abierto o drop"
                            >
                              {CHORD_FORMS.map((form) => (
                                <option
                                  key={form.value}
                                  value={form.value}
                                  disabled={isDropForm(form.value) && !chordEnginePlan.ui.dropEligible}
                                >
                                  {form.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="mt-1 flex h-7 items-center rounded-xl border border-slate-200 bg-slate-100 px-2 text-xs text-slate-500">
                              Automática
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Inversión</label>
                          <select className={UI_SELECT_SM_AUTO + " mt-1"} style={{ width: chordInversionSelectWidth }} value={chordInversion} onChange={(e) => setChordInversion(e.target.value)}>
                            {CHORD_INVERSIONS.map((inv) => (
                              <option key={inv.value} value={inv.value} disabled={!chordEnginePlan.ui.allowThirdInversion && inv.value === "3"}>
                                {inv.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Extensiones</label>
                          <div className={UI_EXT_GRID}>
                            {chordEnginePlan.ui.ext.showSeven ? (
                              <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={hasEffectiveSeventh({ structure: chordStructure, ext7: chordExt7, ext6: chordExt6, ext9: chordExt9, ext11: chordExt11, ext13: chordExt13 })} onChange={(e) => setChordExt7(e.target.checked)} disabled={!chordEnginePlan.ui.ext.canToggleSeven} /> 7
                              </label>
                            ) : null}
                            {chordEnginePlan.ui.ext.showSix ? (
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={chordExt6}
                                  onChange={(e) => {
                                    const v = e.target.checked;
                                    setChordExt6(v);
                                    if (v) setChordExt13(false);
                                    if (chordStructure === "tetrad") {
                                      setChordExt9(false);
                                      setChordExt11(false);
                                      setChordExt13(false);
                                    }
                                  }}
                                  disabled={!chordEnginePlan.ui.ext.canToggleSix}
                                /> 6
                              </label>
                            ) : null}
                            {chordEnginePlan.ui.ext.showNine ? (
                              <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={chordExt9}
                                  onChange={(e) => {
                                    const v = e.target.checked;
                                    if (chordStructure === "tetrad") {
                                      setChordExt9(v);
                                      if (v) {
                                        setChordExt11(false);
                                        setChordExt13(false);
                                      }
                                    } else {
                                      setChordExt9(v);
                                    }
                                  }}
                                  disabled={!chordEnginePlan.ui.ext.canToggleNine}
                                /> 9
                              </label>
                            ) : null}
                            {chordEnginePlan.ui.ext.showEleven ? (
                              <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={chordExt11}
                                  onChange={(e) => {
                                    const v = e.target.checked;
                                    if (chordStructure === "tetrad") {
                                      setChordExt11(v);
                                      if (v) {
                                        setChordExt9(false);
                                        setChordExt13(false);
                                      }
                                    } else {
                                      setChordExt11(v);
                                    }
                                  }}
                                  disabled={!chordEnginePlan.ui.ext.canToggleEleven}
                                /> 11
                              </label>
                            ) : null}
                            {chordEnginePlan.ui.ext.showThirteen ? (
                              <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={chordExt13}
                                  onChange={(e) => {
                                    const v = e.target.checked;
                                    if (chordStructure === "tetrad") {
                                      setChordExt13(v);
                                      if (v) {
                                        setChordExt6(false);
                                        setChordExt9(false);
                                        setChordExt11(false);
                                      }
                                    } else {
                                      setChordExt13(v);
                                    }
                                  }}
                                  disabled={!chordEnginePlan.ui.ext.canToggleThirteen}
                                /> 13
                              </label>
                            ) : null}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Voicing ({chordVoicings.length} opciones)</label>
                          <div className="mt-1 flex items-center gap-1.5">
                            <button
                              type="button"
                              className={UI_BTN_SM}
                              title="Anterior"
                              onClick={() => {
                                if (!chordVoicings.length) return;
                                const nextIdx = (chordVoicingIdx - 1 + chordVoicings.length) % chordVoicings.length;
                                setChordVoicingIdx(nextIdx);
                                setChordSelectedFrets(chordVoicings[nextIdx]?.frets ?? null);
                              }}
                              disabled={!chordVoicings.length}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>

                            <select
                              className={UI_SELECT_SM + " min-w-0 flex-1 max-w-[152px]"}
                              value={chordSelectedFrets || chordVoicings[chordVoicingIdx]?.frets || ""}
                              onChange={(e) => {
                                const f = e.target.value;
                                const idx = chordVoicings.findIndex((v) => v.frets === f);
                                if (idx >= 0) {
                                  setChordVoicingIdx(idx);
                                  setChordSelectedFrets(f);
                                }
                              }}
                              disabled={!chordVoicings.length}
                            >
                              {chordVoicings.map((v, i) => (
                                <option key={v.frets} value={v.frets}>
                                  {`${i + 1}. ${v.frets} (dist ${v.reach ?? (v.span + 1)})`}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              className={UI_BTN_SM}
                              title="Siguiente"
                              onClick={() => {
                                if (!chordVoicings.length) return;
                                const nextIdx = (chordVoicingIdx + 1) % chordVoicings.length;
                                setChordVoicingIdx(nextIdx);
                                setChordSelectedFrets(chordVoicings[nextIdx]?.frets ?? null);
                              }}
                              disabled={!chordVoicings.length}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                                                    {chordDbError ? <div className="mt-1 text-[11px] font-semibold text-rose-600">{chordDbError}</div> : null}
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Dist.</label>
                          <select className={UI_SELECT_SM + " mt-1 w-full"} value={chordMaxDist} onChange={(e) => setChordMaxDist(parseInt(e.target.value, 10))}>
                            {[4, 5, 6].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      )}
                    </fieldset>
                  </section>

                  {chordDetectMode ? (
                    <>
                      <ChordInvestigationFretboard />
                      <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                        <div className="text-sm font-semibold text-slate-800">Posibles acordes</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {chordDetectSelectedNotes.length
                            ? "Selecciona una lectura para copiarla a la sección Acorde."
                            : "Añade notas en el mástil para ver lecturas posibles."}
                        </div>
                        <div className="mt-3 space-y-2">
                          {chordDetectCandidates.length ? chordDetectCandidates.map((cand) => (
                            <div key={cand.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                              <label className="flex min-w-0 flex-1 items-start gap-3">
                                <input
                                  type="radio"
                                  name="detected-chord"
                                  checked={chordDetectCandidateId === cand.id}
                                  onChange={() => selectDetectedCandidate(cand)}
                                  className="mt-0.5 h-4 w-4"
                                />
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-800">{cand.name}</div>
                                  <div>{cand.intervalPairsText}</div>
                                </div>
                              </label>
                              <button
                                type="button"
                                className={UI_BTN_SM + " w-auto shrink-0 px-3"}
                                onClick={() => applyDetectedCandidate(cand)}
                                disabled={!cand.uiPatch}
                                title={cand.uiPatch ? "Copiar esta lectura a la sección Acorde" : "Esta lectura no es compatible con el constructor superior"}
                              >
                                Copiar en Acorde
                              </button>
                            </div>
                          )) : (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                              No hay lecturas claras todavía. Empieza con 3 o 4 notas.
                            </div>
                          )}
                        </div>
                      </section>
                    </>
                  ) : (
                    chordFamily === "quartal" ? (
                    activeQuartalVoicing ? (
                        <ChordFretboard title={`Acorde ${chordQuartalDisplayName}${chordQuartalDegreeText ? ` · ${chordQuartalDegreeText}` : ""}`}  subtitle={`${chordQuartalUiText}${chordQuartalStepText ? ` · ${chordQuartalStepText}` : ""}.`} voicing={activeQuartalVoicing}
                          voicingIdx={chordQuartalVoicingIdx}
			  voicingTotal={Math.max(1, chordQuartalVoicings.length)}
			  roleForPc={quartalRoleOfPc}
			  labelForPc={labelForQuartalPc}
			  noteNameForPc={quartalNoteNameForPc}
			/>
  ) : (
    <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <div className="text-sm font-semibold text-slate-800">Acorde cuartal</div>
      <div className="mt-1 text-xs text-slate-600">
        {chordQuartalDisplayName}
        {chordQuartalDegreeText ? ` · ${chordQuartalDegreeText}` : ""}
        {" · "}
        {chordQuartalUiText}
      </div>
      <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
        No he encontrado voicings cuartales con los filtros actuales. Prueba a subir la distancia o a permitir cuerdas al aire.
      </div>
    </section>
  )
) : chordFamily === "guide_tones" ? (
  activeGuideToneVoicing ? (
    <GuideToneFretboard
      title={`Acorde ${guideToneDisplayName} · ${chordFamily === "guide_tones" ? "Notas guía" : chordFamily === "quartal" ? quartalSectionDisplayName : chordFamily === "tertian" ? tertianSectionDisplayName : chordFamily === "drop_voicing" ? dropVoicingSectionDisplayName : chordFamily === "triads" ? triadSectionDisplayName : chordFamily === "sevenths" ? seventhSectionDisplayName : ""}`}
      voicing={activeGuideToneVoicing}
      voicingIdx={guideToneVoicingIdx}
      voicingTotal={Math.max(1, guideToneVoicings.length)}
    />
  ) : (
    <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <div className="text-sm font-semibold text-slate-800">Notas guía</div>
      <div className="mt-1 text-xs text-slate-600">{guideToneSectionDisplayName}</div>
      <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
        No he encontrado shells de notas guía con los filtros actuales. Prueba a cambiar forma, inversión o distancia.
      </div>
    </section>
  )
) : (
  <ChordFretboard
    title={`Acorde ${chordSectionDisplayName}`}
    voicing={activeChordVoicing}
    voicingIdx={chordVoicingIdx}
    voicingTotal={Math.max(1, chordVoicings.length)}
  />
)

                  )}
                  <StudyPanel />

                  {/* ACORDES CERCANOS */}
                  <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">Acordes cercanos</div>
                        <div className="text-xs text-slate-600">Selecciona hasta 4 acordes y busca digitaciones dentro de un rango. Ordena por cercanía al primer acorde activo.</div>
                        <div className="text-xs text-slate-500">Los acordes se ajustan automáticamente según la nota raíz y la escala activas.</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">Auto escala</span>
                        <button
                          type="button"
                          className={`rounded-xl px-2 py-1 text-xs ring-1 ring-slate-200 shadow-sm ${nearAutoScaleSync ? "bg-slate-900 text-white" : "bg-white"}`}
                          onClick={() => setNearAutoScaleSync((v) => !v)}
                          title="Activa o desactiva el ajuste automático de acordes cercanos según la escala"
                        >
                          {nearAutoScaleSync ? "ON" : "OFF"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-slate-600">
                      <b>Posibles tonalidades:</b> {nearTonalityAnalysis.text}
                    </div>

                    <div className="mt-3 space-y-2">
                      {nearSlots.map((slot, idx) => {
                        const disableAll = !slot.enabled;
                        const notes = spellChordNotesForSlot(slot).join(", ");
                        const chordName = chordDisplayNameFromUI({
                          rootPc: slot.rootPc,
                          preferSharps: slot?.spellPreferSharps ?? preferSharpsFromMajorTonicPc(mod12(slot.rootPc)),
                          quality: slot.quality,
                          suspension: slot.suspension || "none",
                          structure: slot.structure,
                          ext7: slot.ext7,
                          ext6: slot.ext6,
                          ext9: slot.ext9,
                          ext11: slot.ext11,
                          ext13: slot.ext13,
                        });

                        const r = nearComputed.ranked[idx];
                        const selectedVoicing = nearComputed.selected[idx] || null;
                        const slotDisplayName = buildChordHeaderSummary({
                          name: chordName,
                          plan: r?.plan,
                          voicing: selectedVoicing,
                          positionForm: slot.positionForm,
                        });
                        const slotUi = r?.plan?.ui || buildChordUiRestrictions({
                          structure: slot.structure,
                          ext7: slot.ext7,
                          ext6: slot.ext6,
                          ext9: slot.ext9,
                          ext11: slot.ext11,
                          ext13: slot.ext13,
                        });
                        const rankedOptions = r?.ranked || [];
                        const options = [...rankedOptions]
                          .sort((a, b) => (a.minFret - b.minFret) || ((a.reach ?? (a.span + 1)) - (b.reach ?? (b.span + 1))) || (a.maxFret - b.maxFret) || a.frets.localeCompare(b.frets))
                          .slice(0, idx === 0 ? 60 : 40);
                        const errMsg = r?.err || null;

                        return (
                          <div key={idx} className={`rounded-2xl border border-slate-200 p-3 ${disableAll ? "bg-slate-50" : "bg-white"}`}>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <span>Acorde {idx + 1}{nearComputed.baseIdx === idx ? " (referencia)" : ""}</span>
                                <span className="text-xs font-semibold text-slate-800">{slotDisplayName}</span>
                                <span className="text-xs font-normal text-slate-600">(Notas: {notes})</span>
      
                              </div>

                              <div className="flex items-center gap-2">
                                <label
                                  className="inline-flex h-7 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                                  title="Permite usar cuerdas al aire como opción de voicing dentro del rango. La distancia se calcula solo con las notas pisadas."
                                >
                                  <span>Permitir cuerdas al aire</span>
                                  <input
                                    type="checkbox"
                                    checked={slot.allowOpenStrings === true}
                                    onChange={(e) => updateNearSlot(idx, { allowOpenStrings: e.target.checked, selFrets: null })}
                                    disabled={disableAll}
                                    title="Permite usar cuerdas al aire como opción de voicing dentro del rango. La distancia se calcula solo con las notas pisadas."
                                    className="h-4 w-4 rounded border-slate-300"
                                  />
                                </label>
                                <button
                                  type="button"
                                  className={UI_BTN_SM + " w-auto px-3"}
                                  title="Abre el análisis del acorde, del voicing y de sus tensiones."
                                  onClick={() => {
                                    setStudyTarget(String(idx));
                                    setStudyOpen(true);
                                  }}
                                >
                                  Estudiar
                                </button>
                                <span className="text-xs font-semibold text-slate-700">Fondo</span>
                                <input
                                  type="color"
                                  value={nearBgColors[idx]}
                                  onChange={(e) => setNearBgColor(idx, e.target.value)}
                                  className="h-6 w-10 cursor-pointer rounded-md border border-slate-200 bg-white"
                                  disabled={disableAll}
                                />
                                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={!!slot.enabled}
                                    onChange={(e) => updateNearSlot(idx, { enabled: e.target.checked, selFrets: null })}
                                    className="h-4 w-4 rounded border-slate-300"
                                    title={`Activar/desactivar Acorde ${idx + 1}`}
                                  />
                                  Activo
                                </label>
                              </div>
                            </div>

                            <div className="mt-2 grid items-stretch gap-2 grid-cols-[96px_210px_90px_200px_200px_130px_220px_56px]">
                              <div className="min-w-0">
                                <label className={UI_LABEL_SM}>Tono</label>
                                <div className="mt-1 flex items-center gap-1.5">
                                  <select
                                    className={UI_SELECT_SM_TONE}
                                    value={chordUiLetterFromPc(slot.rootPc, !!slot.spellPreferSharps)}
                                    onChange={(e) => {
                                      const letter = e.target.value;
                                      if (Object.prototype.hasOwnProperty.call(NATURAL_PC, letter)) {
                                        updateNearSlot(idx, { rootPc: mod12(NATURAL_PC[letter]), selFrets: null });
                                      }
                                    }}
                                    disabled={disableAll}
                                  >
                                    {LETTERS.map((l) => (
                                      <option key={l} value={l}>{l}</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className={`${UI_BTN_SM} ${(!NATURAL_PCS.has(mod12(slot.rootPc)) && !slot.spellPreferSharps) ? "!bg-slate-900 !text-white !border-slate-900" : ""}`}
                                    title="Bajar 1 semitono"
                                    onClick={() => {
                                      const letter = chordUiLetterFromPc(slot.rootPc, false);
                                      const nat = mod12(NATURAL_PC[letter]);
                                      const cur = mod12(slot.rootPc);
                                      if (cur !== nat) {
                                        updateNearSlot(idx, { rootPc: nat, selFrets: null, spellPreferSharps: false });
                                        return;
                                      }
                                      updateNearSlot(idx, { rootPc: mod12(nat - 1), selFrets: null, spellPreferSharps: false });
                                    }}
                                    disabled={disableAll}
                                  >b</button>
                                  <button
                                    type="button"
                                    className={`${UI_BTN_SM} ${(!NATURAL_PCS.has(mod12(slot.rootPc)) && slot.spellPreferSharps) ? "!bg-slate-900 !text-white !border-slate-900" : ""}`}
                                    title="Subir 1 semitono"
                                    onClick={() => {
                                      const letter = chordUiLetterFromPc(slot.rootPc, true);
                                      const nat = mod12(NATURAL_PC[letter]);
                                      const cur = mod12(slot.rootPc);
                                      if (cur !== nat) {
                                        updateNearSlot(idx, { rootPc: nat, selFrets: null, spellPreferSharps: true });
                                        return;
                                      }
                                      updateNearSlot(idx, { rootPc: mod12(nat + 1), selFrets: null, spellPreferSharps: true });
                                    }}
                                    disabled={disableAll}
                                  >#</button>
                                </div>
                              </div>

                              <div className="min-w-0">
                                <label className={UI_LABEL_SM}>Calidad / Sus</label>
                                <div className="mt-1 grid gap-1.5" style={{ gridTemplateColumns: "minmax(0,1.9fr) minmax(0,1fr)" }}>
                                  <select className={UI_SELECT_SM} value={slot.quality} onChange={(e) => updateNearSlot(idx, { quality: e.target.value, selFrets: null })} disabled={disableAll}>
                                    {CHORD_QUALITIES.map((q) => (
                                      <option key={q.value} value={q.value} disabled={(q.value === "hdim" && slot.structure === "triad" && !slot.ext7) || (q.value === "dom" && slot.structure === "triad" && !slot.ext7)}>{q.label}</option>
                                    ))}
                                  </select>
                                  <select
                                    className={UI_SELECT_SM}
                                    value={slot.suspension || "none"}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      updateNearSlot(idx, { suspension: v, selFrets: null });
                                      if (v !== "none" && (slot.quality === "dim" || slot.quality === "hdim")) {
                                        updateNearSlot(idx, { quality: "maj", selFrets: null });
                                      }
                                    }}
                                    disabled={disableAll}
                                    title="Suspensión: reemplaza la 3ª por 2ª o 4ª"
                                  >
                                    <option value="none">Sus —</option>
                                    <option value="sus2">sus2</option>
                                    <option value="sus4">sus4</option>
                                  </select>
                                </div>
                              </div>

                              <div className="min-w-0">
                                <label className={UI_LABEL_SM}>Estructura</label>
                                <select
                                  className={UI_SELECT_SM + " mt-1"}
                                  value={slot.structure}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const patch = val === "triad"
                                      ? { ext6: false, ext7: false, ext9: false, ext11: false, ext13: false }
                                      : val === "chord"
                                        ? {}
                                        : { ext9: false, ext11: false, ext13: false };
                                    updateNearSlot(idx, {
                                      structure: val,
                                      selFrets: null,
                                      ...(val === "triad" || val === "tetrad"
                                        ? { inversion: "all", form: "open", positionForm: "open" }
                                        : {}),
                                      ...patch,
                                    });
                                  }}
                                  disabled={disableAll}
                                >
                                  {CHORD_STRUCTURES.map((s) => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="min-w-0">
                                <label className={UI_LABEL_SM}>Forma</label>
                                {slotUi.usesManualForm ? (
                                  <select
                                    className={UI_SELECT_SM + " mt-1"}
                                    value={slot.form}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      updateNearSlot(idx, {
                                        form: v,
                                        positionForm: isDropForm(v) ? (slot.positionForm || "closed") : v,
                                        selFrets: null,
                                      });
                                    }}
                                    disabled={disableAll}
                                    title="Elige la disposición del acorde: cerrado, abierto o drop"
                                  >
                                    {CHORD_FORMS.map((form) => (
                                      <option key={form.value} value={form.value} disabled={isDropForm(form.value) && !slotUi.dropEligible}>{form.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="mt-1 flex h-7 items-center rounded-xl border border-slate-200 bg-slate-100 px-2 text-xs text-slate-500">Automática</div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <label className={UI_LABEL_SM}>Inversión</label>
                                <select className={UI_SELECT_SM + " mt-1"} value={slot.inversion} onChange={(e) => updateNearSlot(idx, { inversion: e.target.value, selFrets: null })} disabled={disableAll}>
                                  {CHORD_INVERSIONS.map((inv) => (
                                    <option key={inv.value} value={inv.value} disabled={!slotUi.allowThirdInversion && inv.value === "3"}>{inv.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="min-w-0">
                                <label className={UI_LABEL_SM}>Extensiones</label>
                                <div className={UI_EXT_GRID}>
                                  {slotUi.ext.showSeven ? (
                                    <label className="inline-flex items-center gap-2">
                                      <input type="checkbox" checked={hasEffectiveSeventh({ structure: slot.structure, ext7: slot.ext7, ext6: slot.ext6, ext9: slot.ext9, ext11: slot.ext11, ext13: slot.ext13 })} onChange={(e) => updateNearSlot(idx, { ext7: e.target.checked, selFrets: null })} disabled={disableAll || !slotUi.ext.canToggleSeven} /> 7
                                    </label>
                                  ) : null}
                                  {slotUi.ext.showSix ? (
                                    <label className="inline-flex items-center gap-2">
                                      <input type="checkbox" checked={!!slot.ext6} onChange={(e) => updateNearSlot(idx, { ext6: e.target.checked, selFrets: null })} disabled={disableAll || !slotUi.ext.canToggleSix} /> 6
                                    </label>
                                  ) : null}
                                  {slotUi.ext.showNine ? (
                                    <label className="inline-flex items-center gap-2">
                                      <input type="checkbox" checked={!!slot.ext9} onChange={(e) => updateNearSlot(idx, { ext9: e.target.checked, selFrets: null })} disabled={disableAll || !slotUi.ext.canToggleNine} /> 9
                                    </label>
                                  ) : null}
                                  {slotUi.ext.showEleven ? (
                                    <label className="inline-flex items-center gap-2">
                                      <input type="checkbox" checked={!!slot.ext11} onChange={(e) => updateNearSlot(idx, { ext11: e.target.checked, selFrets: null })} disabled={disableAll || !slotUi.ext.canToggleEleven} /> 11
                                    </label>
                                  ) : null}
                                  {slotUi.ext.showThirteen ? (
                                    <label className="inline-flex items-center gap-2">
                                      <input type="checkbox" checked={!!slot.ext13} onChange={(e) => updateNearSlot(idx, { ext13: e.target.checked, selFrets: null })} disabled={disableAll || !slotUi.ext.canToggleThirteen} /> 13
                                    </label>
                                  ) : null}
                                </div>
                              </div>

                              <div className="min-w-0 flex-1">
                                <label className={UI_LABEL_SM}>Digitación en rango ({options.length} opciones)</label>
                                <div className="mt-1 flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    className={UI_BTN_SM}
                                    title="Anterior"
                                    onClick={() => {
                                      if (!options.length) return;
                                      const cur = slot.selFrets ?? options[0].frets;
                                      let iCur = options.findIndex((v) => v.frets === cur);
                                      if (iCur < 0) iCur = 0;
                                      const iNew = (iCur - 1 + options.length) % options.length;
                                      updateNearSlot(idx, { selFrets: options[iNew].frets });
                                    }}
                                    disabled={disableAll || !options.length}
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </button>

                                  <select
                                    className={UI_SELECT_SM + " min-w-0 flex-1 max-w-[152px]"}
                                    value={slot.selFrets || "(auto)"}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      updateNearSlot(idx, { selFrets: v === "(auto)" ? null : v });
                                    }}
                                    disabled={disableAll}
                                  >
                                    <option value="(auto)">(auto)</option>
                                    {options.map((v) => (
                                      <option key={v.frets} value={v.frets}>{`${v.frets} (min ${v.minFret} · dist ${v.reach ?? (v.span + 1)})`}</option>
                                    ))}
                                  </select>

                                  <button
                                    type="button"
                                    className={UI_BTN_SM}
                                    title="Siguiente"
                                    onClick={() => {
                                      if (!options.length) return;
                                      const cur = slot.selFrets ?? options[0].frets;
                                      let iCur = options.findIndex((v) => v.frets === cur);
                                      if (iCur < 0) iCur = 0;
                                      const iNew = (iCur + 1) % options.length;
                                      updateNearSlot(idx, { selFrets: options[iNew].frets });
                                    }}
                                    disabled={disableAll || !options.length}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                                  {errMsg ? <div className="font-semibold text-rose-600">{errMsg}</div> : null}
                                </div>
                              </div>

                              <div className="min-w-0">
                                <label className={UI_LABEL_SM}>Dist.</label>
                                <select className={UI_SELECT_SM + " mt-1 w-full"} value={slot.maxDist || 4} onChange={(e) => updateNearSlot(idx, { maxDist: parseInt(e.target.value, 10), selFrets: null })} disabled={disableAll}>
                                  {[4, 5, 6].map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <NearChordsFretboard />
                  </section>
                </div>
              ) : null}
            </div>
          </div>

          {/* DERECHA */}
          <aside className="space-y-4 max-w-[190px]">
            <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className="mb-2 text-sm font-semibold text-slate-800">Colores (círculos)</div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { k: "root", label: legend.root },
                  { k: "third", label: legend.third },
                  { k: "fifth", label: legend.fifth },
                  { k: "other", label: legend.other },
                  { k: "extra", label: legend.extra },
                  { k: "route", label: "Ruta (fondo)" },
                ].map((it) => (
                  <div key={it.k} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-700">{it.label}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">{colors[it.k]}</div>
                    </div>
                    <input
                      type="color"
                      value={colors[it.k]}
                      onChange={(e) => setColor(it.k, e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded-md border border-slate-200 bg-white"
                    />
                  </div>
                ))}
              </div>
            </section>
            {showBoards.chords ? (
              <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                <div className="mb-2 text-sm font-semibold text-slate-800">Colores (acordes: 7/6/9/11/13)</div>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { k: "seventh", label: "7" },
                    { k: "sixth", label: "6" },
                    { k: "ninth", label: "9" },
                    { k: "eleventh", label: "11" },
                    { k: "thirteenth", label: "13" },
                  ].map((it) => (
                    <div key={it.k} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-700">{it.label}</div>
                        <div className="mt-0.5 text-[10px] text-slate-500">{colors[it.k]}</div>
                      </div>
                      <input
                        type="color"
                        value={colors[it.k]}
                        onChange={(e) => setColor(it.k, e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded-md border border-slate-200 bg-white"
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {showBoards.patterns ? (
<section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className="mb-2 text-sm font-semibold text-slate-800">Colores (patrones)</div>
              <div className="grid grid-cols-1 gap-2">
                {Array.from({ length: 7 }, (_, i) => i).map((i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-700">Patrón {i + 1}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">{patternColors[i]}</div>
                    </div>
                    <input
                      type="color"
                      value={patternColors[i]}
                      onChange={(e) => setPatternColor(i, e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded-md border border-slate-200 bg-white"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                Patrones disponibles: {patternsMode === "caged" ? "5 CAGED" : scaleIntervals.length === 5 ? "5 boxes" : scaleIntervals.length === 7 ? "7 3NPS" : "(sin patrones)"}.
              </div>
            </section>
            ) : null}
          </aside>
        </div>
              <ManualOverlay />
        <footer className="mt-6 flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-600">
          <span>Creado por: Jesus Quevedo Rodriguez</span>
        </footer>
      </div>
    </div>
  );
}
