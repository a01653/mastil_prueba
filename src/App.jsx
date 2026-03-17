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

  // Otras útiles
  "Blues (menor)": [0, 3, 5, 6, 7, 10],
  "Blues (mayor)": [0, 2, 3, 4, 7, 9],
  "Tonos enteros": [0, 2, 4, 6, 8, 10],
  "Disminuida (H-W)": [0, 1, 3, 4, 6, 7, 9, 10],
  "Disminuida (W-H)": [0, 2, 3, 5, 6, 8, 9, 11],

  "Personalizada": null,
};

const SCALE_NAME_ALIASES = {
  "Escala mayor": "Mayor",
  "Escala menor (natural)": "Menor natural",
};

const SCALE_OPTION_ORDER = [
  "Mayor",
  "Mayor armónica",
  "Doble armónica (Bizantina)",
  "Pentatónica mayor",
  "Blues (mayor)",
  "Menor natural",
  "Menor armónica",
  "Menor melódica (asc)",
  "Pentatónica menor",
  "Blues (menor)",
  "Húngara menor (Gypsy)",
  "Jónica (Ionian)",
  "Dórica (Dorian)",
  "Frigia (Phrygian)",
  "Lidia (Lydian)",
  "Mixolidia (Mixolydian)",
  "Eólica (Aeolian)",
  "Locria (Locrian)",
  "Frigia dominante",
  "Lidia dominante",
  "Alterada (Superlocria)",
  "Tonos enteros",
  "Disminuida (H-W)",
  "Disminuida (W-H)",
  "Bebop mayor",
  "Bebop dominante",
  "Bebop dórica",
  "Personalizada",
];

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
  "Blues (mayor)": [
    { scaleIdx: 0, degreeLabel: "I", suffix: "maj7" },
    { scaleIdx: 1, degreeLabel: "II", suffix: "m7" },
    { scaleIdx: 3, degreeLabel: "III", suffix: "m7" },
    { scaleIdx: 4, degreeLabel: "V", suffix: "7" },
    { scaleIdx: 5, degreeLabel: "VI", suffix: "m7" },
  ],
  "Blues (menor)": [
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

function hasInlayCell(fret, sIdx) {
  return (INLAY_SINGLE.has(fret) && sIdx === 2) || (INLAY_DOUBLE.has(fret) && (sIdx === 1 || sIdx === 3));
}


const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NATURAL_PCS = new Set(Object.values(NATURAL_PC));
const IONIAN_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

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
// Acordes UI: selector de Tono por letra + ♭/♯ (sin C#/Db en el combo)
// - El combo muestra solo C D E F G A B.
// - Los botones ♭/♯ desplazan 1 semitono y fijan la “ortografía” (C# vs Db).
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

// ------------------------
// Acordes
// ------------------------

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
      inversion: "root",
      form: "closed",
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
    inversion: "root",
    form: "closed",
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
// En producción (Pages) suele ser "/mastil_escalas/" y en dev "/".
// OJO: nunca accedas a import.meta.env.BASE_URL sin optional chaining.
// En Vite existe import.meta.env.BASE_URL ("/" en dev, "/<repo>/" en GitHub Pages).
// Evitamos sintaxis TS "as any" porque puede romper el parser en algunos entornos.
const APP_BASE = (import.meta && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : "/";
// Fallback (cuando se ejecuta fuera del repo, p.ej. sandbox): GitHub Pages del proyecto
const PAGES_BASE = "https://a01653.github.io/mastil_escalas/";
const UI_STORAGE_KEY = "mastil_interactivo_guitarra_config_v1";
const UI_PRESETS_STORAGE_KEY = "mastil_interactivo_guitarra_presets_v1";
const UI_STATUS_SESSION_KEY = "mastil_interactivo_guitarra_status_v1";
const QUICK_PRESET_COUNT = 3;
const UI_CONFIG_VERSION = 1;
const APP_VERSION = "1.65";
const APP_VERSION_STAMP = "2026-03-13 08:22";

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

  const minFret = Math.min(...notes.map((n) => n.fret));
  const maxF = Math.max(...notes.map((n) => n.fret));
  const span = maxF - minFret;
  const reach = maxF - minFret + 1;

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
    relIntervals: new Set(notes.map((n) => mod12(n.pc - rootPc))),
  };
}

function isErgonomicVoicing(v, maxReachLimit = 4) {
  if (!v?.notes?.length) return false;

  const fretted = v.notes.filter((n) => n.fret > 0);
  const reach = v.reach ?? ((v.maxFret - v.minFret) + 1);
  const frets = fretted.map((n) => n.fret).sort((a, b) => a - b);

  // Distancia/alcance real entre el primer y el último traste, contando ambos.
  if (reach > maxReachLimit) return false;

  // Evita huecos muy grandes entre dedos.
  for (let i = 1; i < frets.length; i++) {
    if (frets[i] - frets[i - 1] > 3) return false;
  }

  return true;
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
          const nextMin = minF == null ? fret : Math.min(minF, fret);
          const nextMax = maxF2 == null ? fret : Math.max(maxF2, fret);
          if (nextMax - nextMin > maxSpan) continue;
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

function normalizeChordFormToInversion(form) {
  return ["root", "1", "2", "3"].includes(form) ? form : "root";
}

function isStrictFourNoteDropEligible({ structure, ext7, ext6, ext9, ext11, ext13 }) {
  return structure === "tetrad" && hasEffectiveSeventh({ structure, ext7, ext6, ext9, ext11, ext13 }) && !ext6 && !ext9 && !ext11 && !ext13;
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
  const thirdOffset = chordThirdOffsetFromUI(quality, suspension);
  const fifthOffset = chordFifthOffsetFromUI(quality, suspension);
  const seventhOffset = hasEffectiveSeventh({ structure, ext7, ext6, ext9, ext11, ext13 }) ? seventhOffsetForQuality(quality) : null;
  const intervals = buildChordIntervals({ quality, suspension, structure, ext7, ext6, ext9, ext11, ext13 });
  const bassInterval = chordBassInterval({
    quality,
    suspension,
    structure,
    inversion: normalizeChordFormToInversion(inversion),
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
    inversion: normalizeChordFormToInversion(inversion),
    form,
    ext7,
    ext6,
    ext9,
    ext11,
    ext13,
    thirdOffset,
    fifthOffset,
    seventhOffset,
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
    default: return "—";
  }
}

function studyVoicingFormLabel(voicing, form) {
  if (isDropForm(form)) {
    return CHORD_FORMS.find((x) => x.value === form)?.label || "Drop";
  }
  if (!voicing) return isOpenForm(form) ? "Abierto" : "Cerrado";
  return isClosedPositionVoicing(voicing) ? "Cerrado" : "Abierto";
}

function explainStudyRules(plan) {
  if (!plan) return [];
  const out = [];
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
  if (plan.seventhOffset != null && bassInt === mod12(plan.seventhOffset)) return "3ª inversión";
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
    relation: `V7 → ${targetName}`,
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
    relation: `bVII7 → ${targetName}`,
  };
}

const CHORD_DETECT_FORMULAS = [
  { id: "maj", intervals: [0, 4, 7], degreeLabels: ["1", "3", "5"], suffix: "", ui: { quality: "maj", suspension: "none", structure: "triad", inversion: "root", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "min", intervals: [0, 3, 7], degreeLabels: ["1", "b3", "5"], suffix: "m", ui: { quality: "min", suspension: "none", structure: "triad", inversion: "root", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "dim", intervals: [0, 3, 6], degreeLabels: ["1", "b3", "b5"], suffix: "dim", ui: { quality: "dim", suspension: "none", structure: "triad", inversion: "root", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "sus2", intervals: [0, 2, 7], degreeLabels: ["1", "2", "5"], suffix: "sus2", ui: { quality: "maj", suspension: "sus2", structure: "triad", inversion: "root", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "sus4", intervals: [0, 5, 7], degreeLabels: ["1", "4", "5"], suffix: "sus4", ui: { quality: "maj", suspension: "sus4", structure: "triad", inversion: "root", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "6", intervals: [0, 4, 7, 9], degreeLabels: ["1", "3", "5", "6"], suffix: "6", ui: { quality: "maj", suspension: "none", structure: "tetrad", inversion: "root", form: "open", positionForm: "open", ext7: false, ext6: true, ext9: false, ext11: false, ext13: false } },
  { id: "m6", intervals: [0, 3, 7, 9], degreeLabels: ["1", "b3", "5", "6"], suffix: "m6", ui: { quality: "min", suspension: "none", structure: "tetrad", inversion: "root", form: "open", positionForm: "open", ext7: false, ext6: true, ext9: false, ext11: false, ext13: false } },
  { id: "add9", intervals: [0, 2, 4, 7], degreeLabels: ["1", "9", "3", "5"], suffix: "add9", ui: { quality: "maj", suspension: "none", structure: "tetrad", inversion: "root", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: true, ext11: false, ext13: false } },
  { id: "madd9", intervals: [0, 2, 3, 7], degreeLabels: ["1", "9", "b3", "5"], suffix: "m(add9)", ui: { quality: "min", suspension: "none", structure: "tetrad", inversion: "root", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: true, ext11: false, ext13: false } },
  { id: "add11", intervals: [0, 4, 5, 7], degreeLabels: ["1", "3", "11", "5"], suffix: "add11", ui: { quality: "maj", suspension: "none", structure: "tetrad", inversion: "root", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: true, ext13: false } },
  { id: "madd11", intervals: [0, 3, 5, 7], degreeLabels: ["1", "b3", "11", "5"], suffix: "m(add11)", ui: { quality: "min", suspension: "none", structure: "tetrad", inversion: "root", form: "open", positionForm: "open", ext7: false, ext6: false, ext9: false, ext11: true, ext13: false } },
  { id: "maddb13", intervals: [0, 3, 7, 8], degreeLabels: ["1", "b3", "5", "b13"], suffix: "m(addb13)", ui: null },
  { id: "maj9", intervals: [0, 2, 4, 7, 11], degreeLabels: ["1", "9", "3", "5", "7"], suffix: "maj9", ui: { quality: "maj", suspension: "none", structure: "chord", inversion: "root", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: true, ext11: false, ext13: false } },
  { id: "9", intervals: [0, 2, 4, 7, 10], degreeLabels: ["1", "9", "3", "5", "b7"], suffix: "9", ui: { quality: "dom", suspension: "none", structure: "chord", inversion: "root", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: true, ext11: false, ext13: false } },
  { id: "m9", intervals: [0, 2, 3, 7, 10], degreeLabels: ["1", "9", "b3", "5", "b7"], suffix: "m9", ui: { quality: "min", suspension: "none", structure: "chord", inversion: "root", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: true, ext11: false, ext13: false } },
  { id: "maj7", intervals: [0, 4, 7, 11], degreeLabels: ["1", "3", "5", "7"], suffix: "maj7", ui: { quality: "maj", suspension: "none", structure: "tetrad", inversion: "root", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "7", intervals: [0, 4, 7, 10], degreeLabels: ["1", "3", "5", "b7"], suffix: "7", ui: { quality: "dom", suspension: "none", structure: "tetrad", inversion: "root", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "m7", intervals: [0, 3, 7, 10], degreeLabels: ["1", "b3", "5", "b7"], suffix: "m7", ui: { quality: "min", suspension: "none", structure: "tetrad", inversion: "root", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "mmaj7", intervals: [0, 3, 7, 11], degreeLabels: ["1", "b3", "5", "7"], suffix: "m(maj7)", ui: null },
  { id: "m7b5", intervals: [0, 3, 6, 10], degreeLabels: ["1", "b3", "b5", "b7"], suffix: "m7(b5)", ui: { quality: "hdim", suspension: "none", structure: "tetrad", inversion: "root", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: false, ext11: false, ext13: false } },
  { id: "dim7", intervals: [0, 3, 6, 9], degreeLabels: ["1", "b3", "b5", "bb7"], suffix: "dim7", ui: { quality: "dim", suspension: "none", structure: "tetrad", inversion: "root", form: "open", positionForm: "open", ext7: true, ext6: false, ext9: false, ext11: false, ext13: false } },
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
    const rootName = pcToName(rootPc, preferSharps);
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
      if (matches.length < Math.min(formulaIntervals.length, 3)) continue;
      if (missing.length > 1) continue;

      const noteNames = spellChordNotes({ rootPc, chordIntervals: formulaIntervals, preferSharps });
      const visiblePairs = formulaIntervals
        .map((intv, idx) => coreSelected.includes(intv) ? `${formula.degreeLabels[idx]}=${noteNames[idx]}` : null)
        .filter(Boolean);
      const visibleNotes = formulaIntervals
        .map((intv, idx) => coreSelected.includes(intv) ? noteNames[idx] : null)
        .filter(Boolean);
      const missingLabels = formulaIntervals
        .map((intv, idx) => !coreSelected.includes(intv) ? formula.degreeLabels[idx] : null)
        .filter(Boolean);
      const suffix = appendMissingDegreesToSuffix(formula.suffix, missingLabels);
      let slashBass = "";
      if (bass.pc !== rootPc) {
        const bassIdx = formulaIntervals.findIndex((x) => x === bassInterval);
        const slashBassName = bassIdx >= 0
          ? noteNames[bassIdx]
          : spellNoteFromChordInterval(rootPc, bassInterval, preferSharps);
        slashBass = `/${slashBassName}`;
      }
      const name = `${rootName}${suffix}${slashBass}`;
      const exact = missing.length === 0;
      const slashPenalty = bass.pc === rootPc ? 0 : (externalBassInterval == null ? 1 : 3);
      const score = (exact ? 0 : 20) + slashPenalty + missing.length * 6 + Math.max(0, 4 - matches.length);
      const uiPatch = formula.ui ? { rootPc, spellPreferSharps: preferSharps, ...formula.ui } : null;
      const candidate = {
        id: `${formula.id}|${rootPc}|${externalBassInterval == null ? "in" : externalBassInterval}|${missingLabels.join(",")}`,
        name,
        rootPc,
        bassPc: bass.pc,
        preferSharps,
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

      const prev = seen.get(name);
      if (!prev || candidate.score < prev.score) seen.set(name, candidate);
    }
  }

  raw.push(...seen.values());

  const exactSubsetSignatures = new Set(
    raw
      .filter((c) => c.exact)
      .map((c) => `${c.rootPc}|${c.bassPc}|${c.visibleIntervals.slice().sort((a, b) => a - b).join(",")}`)
  );

  const exactCandidates = raw.filter((c) => c.exact);

  const filtered = raw.filter((c) => {
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

  filtered.sort((a, b) => (a.score - b.score) || a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
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
  const degree = idx >= 0 ? candidate.formula.degreeLabels[idx] : null;
  if (!degree) return noteName;
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

      const span = Math.max(...fretsPerLowToHigh.map((x) => x.fret)) - Math.min(...fretsPerLowToHigh.map((x) => x.fret));
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

const CHORD_INVERSIONS = [
  { value: "root", label: "Fundamental" },
  { value: "1", label: "1ª inversión" },
  { value: "2", label: "2ª inversión" },
  { value: "3", label: "3ª inversión" },
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
  if (tag === "input" && type === "checkbox") return label || "Activar o desactivar";
  if (tag === "input") return label || "Introducir valor";

  if (tag === "button") {
    if (ownText === "♭") return "Bajar 1 semitono";
    if (ownText === "♯") return "Subir 1 semitono";
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
        schemaUpdatedAt: APP_VERSION_STAMP,
        config: payload,
      },
    };
  });
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
  const appRootRef = useRef(null);
  const importConfigInputRef = useRef(null);
  const chordDetectAudioCtxRef = useRef(null);

  const [storageHydrated, setStorageHydrated] = useState(false);
  const [configNotice, setConfigNotice] = useState(null);
  const [quickPresets, setQuickPresets] = useState(() => Array.from({ length: QUICK_PRESET_COUNT }, () => null));
  const [studyOpen, setStudyOpen] = useState(false);
  const [studyTarget, setStudyTarget] = useState("main");

  // Notación (auto / override)
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
  const [maxFret, setMaxFret] = useState(15);

  const [showNonScale, setShowNonScale] = useState(false);

  const [customInput, setCustomInput] = useState("1 b3 5 6");

  // Extras (default OFF)
  const [extraInput, setExtraInput] = useState("b2");
  const [showExtra, setShowExtra] = useState(false);

  // Qué mástiles mostrar
  const [showBoards, setShowBoards] = useState({ scale: false, patterns: false, route: false, chords: true });

  // Modo de patrones para el 2º mástil
  const [patternsMode, setPatternsMode] = useState("auto"); // auto | boxes | nps | caged

  // ------------------------
  // Acordes (panel opcional)
  // ------------------------
  const [chordRootPc, setChordRootPc] = useState(5); // F
  const [chordSpellPreferSharps, setChordSpellPreferSharps] = useState(() => preferSharpsFromMajorTonicPc(5));
  const [chordQuality, setChordQuality] = useState("maj");
  const [chordSuspension, setChordSuspension] = useState("none");
  const [chordStructure, setChordStructure] = useState("triad");
  const [chordInversion, setChordInversion] = useState("root");
  const [chordForm, setChordForm] = useState("open");
  const [chordPositionForm, setChordPositionForm] = useState("open");
  const [chordExt7, setChordExt7] = useState(false);
  const [chordExt6, setChordExt6] = useState(false);
  const [chordExt9, setChordExt9] = useState(false);
  const [chordExt11, setChordExt11] = useState(false);
  const [chordExt13, setChordExt13] = useState(false);
  const [chordDetectMode, setChordDetectMode] = useState(false);
  const [chordDetectClickAudio, setChordDetectClickAudio] = useState(false);
  const [chordDetectSelectedKeys, setChordDetectSelectedKeys] = useState([]);
  const [chordDetectCandidateId, setChordDetectCandidateId] = useState(null);



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


  // Voicings de acordes (digitaciones tocables) desde dataset externo
  const [chordDb, setChordDb] = useState(null);
  const [chordDbError, setChordDbError] = useState(null);
  const [chordDbLastUrl, setChordDbLastUrl] = useState(null);
  const [chordVoicingIdx, setChordVoicingIdx] = useState(0);
  const [chordSelectedFrets, setChordSelectedFrets] = useState(null);
  const [chordMaxDist, setChordMaxDist] = useState(4);
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
      inversion: "root",
      form: "open",
      positionForm: "open",
      ext7: false,
      ext6: false,
      ext9: false,
      ext11: false,
      ext13: false,
      spellPreferSharps: chordSpellPreferSharps,
      maxDist: 4,
      selFrets: null,
    };

    const mkEmpty = () => ({
      enabled: false,
      rootPc: chordRootPc,
      quality: "maj",
      suspension: "none",
      structure: "triad",
      inversion: "root",
      form: "closed",
      positionForm: "closed",
      ext7: false,
      ext6: false,
      ext9: false,
      ext11: false,
      ext13: false,
      spellPreferSharps: chordSpellPreferSharps,
      maxDist: 4,
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

  const persistedUiConfig = useMemo(() => ({
    accMode,
    showIntervalsLabel,
    showNotesLabel,
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
    schemaUpdatedAt: APP_VERSION_STAMP,
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
      if ("routeMode" in saved) setRouteMode(sanitizeOneOf(saved.routeMode, ["auto", "free", "pos", "nps", "penta", "caged"], "auto"));
      if ("routePreferNps" in saved) setRoutePreferNps(sanitizeBoolValue(saved.routePreferNps, true));
      if ("routePreferVertical" in saved) setRoutePreferVertical(sanitizeBoolValue(saved.routePreferVertical, false));
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
      schemaUpdatedAt: APP_VERSION_STAMP,
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
          savedAt: APP_VERSION_STAMP,
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

  // Acordes: ortografía del nombre (C# vs Db). No depende de la notación global.
  const chordPreferSharps = chordSpellPreferSharps;

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

  const chordVoicings = useMemo(() => {
    const plan = chordEnginePlan;

    if (plan.generator === "triad") {
      const tri = filterVoicingsByForm(generateTriadVoicings({
        rootPc: plan.rootPc,
        thirdOffset: plan.thirdOffset,
        fifthOffset: plan.fifthOffset,
        inversion: plan.inversion,
        maxFret,
        maxSpan: chordMaxDist,
      }), plan.form);
      return tri.slice(0, 60);
    }

    if (plan.generator === "drop") {
      if (plan.seventhOffset == null) return [];
      const tet = generateDropTetradVoicings({
        rootPc: plan.rootPc,
        thirdOffset: plan.thirdOffset,
        fifthOffset: plan.fifthOffset,
        seventhOffset: plan.seventhOffset,
        form: plan.form,
        inversion: plan.inversion,
        maxFret,
        maxSpan: chordMaxDist,
      });
      return tet.slice(0, 60);
    }

    if (plan.generator === "tetrad") {
      const seventhLike = plan.singleAdd
        ? (plan.ext13 ? 9 : plan.ext11 ? 5 : plan.ext9 ? 2 : 9)
        : plan.seventhOffset;
      if (seventhLike == null) return [];
      const tet = filterVoicingsByForm(generateTetradVoicings({
        rootPc: plan.rootPc,
        thirdOffset: plan.thirdOffset,
        fifthOffset: plan.fifthOffset,
        seventhOffset: seventhLike,
        inversion: plan.inversion,
        maxFret,
        maxSpan: chordMaxDist,
      }), plan.form);
      return tet.slice(0, 60);
    }

    if (plan.generator === "exact") {
      const multi = generateExactIntervalChordVoicings({
        rootPc: plan.rootPc,
        intervals: plan.intervals,
        bassInterval: plan.bassInterval,
        maxFret,
        maxSpan: chordMaxDist,
      });
      return multi.slice(0, 60);
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
        if (bi === plan.bassInterval) outStrict.push(item);
        else outLoose.push(item);
      }

      const list = outStrict.length ? outStrict : outLoose;
      list.sort((a, b) => ((a._extra ?? 0) - (b._extra ?? 0)) || (a.minFret - b.minFret) || (a.span - b.span) || (a.maxFret - b.maxFret));
      return list.slice(0, 60);
    }

    return [];
  }, [chordEnginePlan, chordDb, chordMaxDist, maxFret]);

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

  function applyDetectedCandidate(candidate) {
    if (!candidate) return;
    setChordDetectCandidateId(candidate.id);
    if (candidate.uiPatch) {
      const p = candidate.uiPatch;
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
    } else {
      setChordRootPc(candidate.rootPc);
      setChordSpellPreferSharps(!!candidate.preferSharps);
    }
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

  const chordSectionDisplayName = chordDetectMode && chordDetectSelectedCandidate
    ? chordDetectSelectedCandidate.name
    : chordDisplayNameFromUI({
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

  const nearFrom = nearWindowStart;
  const nearTo = Math.min(maxFret, nearWindowStart + nearWindowSize - 1);
  const nearStartMax = Math.max(0, maxFret - (nearWindowSize - 1));

  function slotThirdOffset(quality, suspension) {
    if (suspension === "sus2") return 2;
    if (suspension === "sus4") return 5;
    return quality === "maj" || quality === "dom" ? 4 : 3;
  }

  function slotFifthOffset(quality, suspension) {
    if (suspension && suspension !== "none") return 7;
    return quality === "dim" || quality === "hdim" ? 6 : 7;
  }

  function spellChordNotesForSlot(slot) {
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
    return spellChordNotes({ rootPc: slot.rootPc, chordIntervals: ints, preferSharps: pref });
  }

  function voicingProximityCost(base, cand) {
    if (!base || !cand) return 9999;
    const bf = base.notes.map((n) => n.fret).sort((a, b) => a - b);
    const cf = cand.notes.map((n) => n.fret).sort((a, b) => a - b);
    const len = Math.min(bf.length, cf.length);
    let cost = Math.abs((base.minFret + base.maxFret) / 2 - (cand.minFret + cand.maxFret) / 2) * 2;
    cost += Math.abs(base.span - cand.span) * 0.8;
    for (let i = 0; i < len; i++) cost += Math.abs(bf[i] - cf[i]);
    return cost;
  }

  function nearestVoicingIndex(ref, options) {
    if (!options?.length) return 0;
    if (!ref) return 0;
    let best = 0;
    let bestCost = Infinity;
    for (let i = 0; i < options.length; i++) {
      const c = voicingProximityCost(ref, options[i]);
      if (c < bestCost) {
        bestCost = c;
        best = i;
      }
    }
    return best;
  }

  function updateNearSlot(idx, patch) {
    setNearSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function buildSlotVoicings(slot) {
    if (!slot?.enabled) return { voicings: [], err: null, plan: null };

    const slotMaxDist = Math.max(1, Math.min(8, Number(slot.maxDist || 4)));
    const plan = buildChordEnginePlan({
      rootPc: slot.rootPc,
      quality: slot.quality,
      suspension: slot.suspension || "none",
      structure: slot.structure,
      inversion: slot.inversion,
      form: slot.form,
      ext7: slot.ext7,
      ext6: slot.ext6,
      ext9: slot.ext9,
      ext11: slot.ext11,
      ext13: slot.ext13,
    });

    const inRange = (v) => v && v.notes.every((n) => n.fret === 0 || (n.fret >= nearFrom && n.fret <= nearTo));

    if (plan.generator === "triad") {
      const tri = filterVoicingsByForm(generateTriadVoicings({
        rootPc: plan.rootPc,
        thirdOffset: plan.thirdOffset,
        fifthOffset: plan.fifthOffset,
        inversion: plan.inversion,
        maxFret: nearTo,
        maxSpan: slotMaxDist,
      }), plan.form).filter(inRange);
      return { voicings: tri, err: tri.length ? null : "No encontré triadas en ese rango", plan };
    }

    if (plan.generator === "drop") {
      if (plan.seventhOffset == null) return { voicings: [], err: "No hay 7ª para esta combinación", plan };
      const tet = generateDropTetradVoicings({
        rootPc: plan.rootPc,
        thirdOffset: plan.thirdOffset,
        fifthOffset: plan.fifthOffset,
        seventhOffset: plan.seventhOffset,
        form: plan.form,
        inversion: plan.inversion,
        maxFret: nearTo,
        maxSpan: slotMaxDist,
      }).filter(inRange);
      return { voicings: tet, err: tet.length ? null : "No encontré drops en ese rango", plan };
    }

    if (plan.generator === "tetrad") {
      const seventhLike = plan.singleAdd
        ? (plan.ext13 ? 9 : plan.ext11 ? 5 : plan.ext9 ? 2 : 9)
        : plan.seventhOffset;
      if (seventhLike == null) return { voicings: [], err: "No hay 7ª para esta combinación", plan };
      const tet = filterVoicingsByForm(generateTetradVoicings({
        rootPc: plan.rootPc,
        thirdOffset: plan.thirdOffset,
        fifthOffset: plan.fifthOffset,
        seventhOffset: seventhLike,
        inversion: plan.inversion,
        maxFret: nearTo,
        maxSpan: slotMaxDist,
      }), plan.form).filter(inRange);
      const err = tet.length ? null : (plan.singleAdd ? "No encontré add* en ese rango" : "No encontré cuatriadas en ese rango");
      return { voicings: tet, err, plan };
    }

    if (plan.generator === "exact") {
      const multi = generateExactIntervalChordVoicings({
        rootPc: plan.rootPc,
        intervals: plan.intervals,
        bassInterval: plan.bassInterval,
        maxFret: nearTo,
        maxSpan: slotMaxDist,
      }).filter(inRange);
      return { voicings: multi, err: multi.length ? null : "No hay add múltiples en rango", plan };
    }

    if (plan.generator === "json") {
      const suffix = chordSuffixFromUI({
        quality: slot.quality,
        suspension: slot.suspension || "none",
        structure: slot.structure,
        ext7: slot.ext7,
        ext6: slot.ext6,
        ext9: slot.ext9,
        ext11: slot.ext11,
        ext13: slot.ext13,
      });
      if (!suffix) return { voicings: [], err: "No hay JSON para esta combinación", plan };

      const keyName = chordDbKeyNameFromPc(plan.rootPc);
      const cacheKey = `${keyName}/${suffix}`;
      const json = chordDbCache[cacheKey];
      const err = chordDbCacheErr[cacheKey];
      if (err) return { voicings: [], err: `Error JSON: ${err}`, plan };
      if (!json) return { voicings: [], err: "Cargando JSON…", plan };

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
      for (const p of json.positions || []) {
        const fretsLH = parseChordDbFretsString(p?.frets);
        if (!fretsLH) continue;
        const v = buildVoicingFromFretsLH({ fretsLH, rootPc: plan.rootPc, maxFret: nearTo });
        if (!v || !isErgonomicVoicing(v, slotMaxDist)) continue;
        if (!inRange(v)) continue;

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
        if (bi === plan.bassInterval) outStrict.push(item);
        else outLoose.push(item);
      }

      const list = outStrict.length ? outStrict : outLoose;
      list.sort((a, b) => ((a._extra ?? 0) - (b._extra ?? 0)) || (a.minFret - b.minFret) || (a.span - b.span) || (a.maxFret - b.maxFret));
      return { voicings: list.slice(0, 60), err: list.length ? null : "No hay voicings en rango", plan };
    }

    return { voicings: [], err: "Estructura no soportada", plan };
  }

  const nearComputed = useMemo(() => {
    const slots = nearSlots.map((s) => buildSlotVoicings(s));

    const anchorIdx = slots.findIndex((x, idx) => !!nearSlots[idx]?.enabled && (x?.voicings || []).length > 0);
    const firstEnabledIdx = nearSlots.findIndex((s) => !!s?.enabled);
    const refIdx = anchorIdx >= 0 ? anchorIdx : firstEnabledIdx;

    const refList = refIdx >= 0 ? (slots[refIdx]?.voicings || []) : [];
    const refSelFrets = refIdx >= 0 ? nearSlots[refIdx]?.selFrets : null;
    const refPicked = refSelFrets ? refList.find((v) => v.frets === refSelFrets) : null;
    const baseVoicing = refPicked || refList[0] || null;

    const ranked = slots.map((x, idx) => {
      const list = x?.voicings || [];
      if (idx === refIdx || !baseVoicing) return { ...x, ranked: list };
      const arr = list.map((v) => ({ ...v, _cost: voicingProximityCost(baseVoicing, v) }));
      arr.sort((a, b) => (a._cost - b._cost) || (a.minFret - b.minFret) || (a.span - b.span));
      return { ...x, ranked: arr.slice(0, 40) };
    });

    const selected = ranked.map((r, idx) => {
      const sel = nearSlots[idx]?.selFrets;
      const list = r?.ranked || [];
      const found = sel ? list.find((x) => x.frets === sel) : null;
      return found || list[0] || null;
    });

    return { ranked, selected, baseVoicing, baseIdx: refIdx };
  }, [nearSlots, nearFrom, nearTo, chordDbCache, chordDbCacheErr, maxFret]);

  const nearRankSig = useMemo(
    () => nearComputed.ranked.map((r) => (r?.ranked || []).map((v) => v.frets).join(",")).join("|"),
    [nearComputed.ranked]
  );

  const nearSelectedSig = useMemo(
    () => nearComputed.selected.map((v) => v?.frets || "").join("|"),
    [nearComputed.selected]
  );

  const studyData = useMemo(() => {
    if (studyTarget === "main") {
      const mainSpelledNotes = spellChordNotes({ rootPc: chordRootPc, chordIntervals, preferSharps: chordPreferSharps });
      const mainPcToSpelledName = (pc) => {
        const interval = mod12(pc - chordRootPc);
        const idx = chordIntervals.findIndex((x) => mod12(x) === interval);
        return idx >= 0 ? mainSpelledNotes[idx] : pcToName(pc, chordPreferSharps);
      };
      return {
        rootPc: chordRootPc,
        preferSharps: chordPreferSharps,
        title: "Acorde principal",
        chordName: chordDisplayNameFromUI({
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
        }),
        notes: mainSpelledNotes,
        intervals: chordIntervals.map((i) => intervalToChordToken(i, { ext6: chordExt6, ext9: chordExt9 && chordStructure !== "triad", ext11: chordExt11 && chordStructure !== "triad", ext13: chordExt13 && chordStructure !== "triad" })),
        plan: chordEnginePlan,
        voicing: activeChordVoicing,
        bassName: activeChordVoicing ? mainPcToSpelledName(activeChordVoicing.bassPc) : pcToName(chordBassPc, chordPreferSharps),
        inversionLabel: CHORD_INVERSIONS.find((x) => x.value === chordInversion)?.label || "Fundamental",
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
  }, [studyTarget, chordRootPc, chordPreferSharps, chordQuality, chordSuspension, chordStructure, chordExt7, chordExt6, chordExt9, chordExt11, chordExt13, chordIntervals, chordEnginePlan, activeChordVoicing, chordBassPc, chordInversion, nearSlots, nearComputed]);

  function StudyPanel() {
    const d = studyData;
    const rules = explainStudyRules(d?.plan);
    const naming = buildChordNamingExplanation(d?.plan);
    const voicingAnalysis = analyzeVoicingVsPlan(d?.plan, d?.voicing, d?.preferSharps ?? chordPreferSharps);
    const tensionAnalysis = analyzeScaleTensionsForChord({
      activeScaleRootPc: rootPc,
      scaleIntervals,
      chordRootPc: d?.rootPc ?? chordRootPc,
      chordIntervals: d?.plan?.intervals || [],
      preferSharps: d?.preferSharps ?? chordPreferSharps,
    });
    const dominant = buildDominantInfo(d?.rootPc ?? chordRootPc, d?.preferSharps ?? chordPreferSharps);
    const backdoorDominant = buildBackdoorDominantInfo(d?.rootPc ?? chordRootPc, d?.preferSharps ?? chordPreferSharps);
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
              <div className="text-xs font-semibold text-slate-700">Selección vs voicing real</div>
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
          </div>
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

  function roleOfPc(pc) {
    const interval = mod12(pc - rootPc);

    // Blues: la “blue note” se pinta como NOTA EXTRA (mismo color que extras), aunque forme parte de la escala.
    // - Blues (menor): b5 / #4 => 6
    // - Blues (mayor): b3 => 3
    const bluesBlue = scaleName === "Blues (menor)" ? 6 : scaleName === "Blues (mayor)" ? 3 : null;
    if (bluesBlue != null && interval === bluesBlue) return "extra";

    if (interval === 0) return "root";
    if (thirdOffsets.includes(interval)) return "third";
    if (interval === 7) return "fifth";
    return "other";
  }

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

  function hoverCellNoteText(sIdx, fret) {
    const pc = mod12(STRINGS[sIdx].pc + fret);
    return pcToDualName(pc);
  }

  function HoverCellNote({ sIdx, fret, visible }) {
    if (!visible) return null;
    return (
      <div className="pointer-events-none absolute inset-0 z-[6] hidden items-center justify-center text-[10px] font-semibold text-slate-500 group-hover:flex">
        {hoverCellNoteText(sIdx, fret)}
      </div>
    );
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

  function Circle({ pc, role, fret, sIdx, badge }) {
    const baseRole = role === "extra" ? "extra" : role;
    return (
      <div
        className="relative z-20 inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
        style={circleStyle(baseRole)}
        title={`${pcToDualName(pc)} · ${intervalToDegreeToken(mod12(pc - rootPc))}`}
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

  function ChordCircle({ pc, role, fret, sIdx, isBass }) {
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
        title={`${chordPcToSpelledName(pc)} · ${intervalToChordToken(mod12(pc - chordRootPc), { ext6: chordExt6, ext9: chordExt9 && chordStructure !== "triad", ext11: chordExt11 && chordStructure !== "triad", ext13: chordExt13 && chordStructure !== "triad" })}${isBass ? " · bajo" : ""}`}
      >
        {labelForChordPc(pc)}
      </div>
    );
  }

  function ChordFretboard({ title, voicing, voicingIdx, voicingTotal }) {
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

    const noteText = voicing
      ? [...voicing.notes]
          .sort((a, b) => pitchAt(a.sIdx, a.fret) - pitchAt(b.sIdx, b.fret))
          .map((n) => chordPcToSpelledName(n.pc))
          .join(" – ")
      : "";

    return (
      <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-800">{title} {voicing ? chordDisplayNameFromUI({ rootPc: chordRootPc, preferSharps: chordPreferSharps, quality: chordQuality, suspension: chordSuspension, structure: chordStructure, ext7: chordExt7, ext6: chordExt6, ext9: chordExt9, ext11: chordExt11, ext13: chordExt13 }) : ""}</div>
            <div className="text-xs text-slate-600">{voicing ? `Notas: ${noteText}. Bajo marcado con anillo negro.` : "No hay voicings para esta selección."}</div>
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
                    {item ? <ChordCircle pc={item.pc} role={chordRoleOfPc(item.pc)} fret={fret} sIdx={sIdx} isBass={item.isBass} /> : null}
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
            <div className="text-sm font-semibold text-slate-800">Acorde por selección manual</div>
            <div className="text-xs text-slate-600">
              {chordDetectSelectedNotes.length
                ? `Notas seleccionadas: ${chordDetectSelectedNotesText}. Pulsa de nuevo para quitar una nota.`
                : "Pulsa en el mástil para añadir o quitar notas y detectar acordes posibles."}
            </div>
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
                    {item ? <ChordInvestigationCircle pc={item.pc} fret={fret} sIdx={sIdx} candidate={chordDetectSelectedCandidate} isBass={item.isBass} /> : (fret === 0 && !selectedStrings.has(sIdx) ? <span className="text-xs font-semibold text-slate-400">X</span> : null)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    );
  }

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

    return (
      <section className="mt-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-800">Mástil: acordes cercanos</div>
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

  function Fretboard({ title, subtitle, mode }) {
    // mode: scale | patterns | route
    const showAllNotes = showNonScale && mode === "scale";

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
                  Ruta: {routeStartCode} → {routeEndCode} | pasos: <b>{routeResult.path.length}</b>
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
                      {shouldRender && displayRole ? (
                        <Circle pc={pc} role={displayRole} fret={fret} sIdx={sIdx} badge={mode === "route" ? routeIdx : null} />
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

  const wrap = "mx-auto min-w-[1500px] max-w-[1500px] p-3";

  // UI compacto (especialmente para Acordes)
  const UI_SELECT_SM = "h-7 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs shadow-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";
  const UI_SELECT_SM_TONE = "h-7 w-[60px] rounded-xl border border-slate-200 bg-white px-1 text-xs shadow-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";
  const UI_BTN_SM = "h-7 w-7 rounded-xl border border-slate-200 bg-white text-xs font-semibold shadow-sm hover:bg-slate-100 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed";
  const UI_INPUT_SM = "h-7 rounded-xl border border-slate-200 bg-white px-2 text-xs shadow-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";
  const UI_LABEL_SM = "block text-[11px] font-semibold text-slate-700";
  const UI_HELP_SM = "text-[11px] text-slate-500";
  const UI_EXT_GRID = "mt-1 grid grid-cols-3 gap-x-3 gap-y-1 text-xs";

  // Estado visual de ♭/♯ (solo para acordes): si la tónica es nota negra, resaltamos ♭ o ♯ según la ortografía.
  const chordAccidental = !NATURAL_PCS.has(mod12(chordRootPc));

  const scaleOptions = useMemo(
    () => Object.keys(SCALE_PRESETS).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    []
  );

  return (
    <div className="min-h-screen overflow-x-auto bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <div ref={appRootRef} className={wrap}>
        <header className="mb-3">
          <h1 className="text-xl font-semibold">Mástil interactivo: escalas, patrones, rutas y acordes</h1>
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
                        title="Bajar 1 semitono (♭). Si ya está alterado, vuelve a natural."
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
                        ♭
                      </button>

                      <button
                        type="button"
                        className={`${UI_BTN_SM} ${scaleRootAcc === "sharp" ? "!bg-slate-900 !text-white !border-slate-900" : ""}`}
                        title="Subir 1 semitono (♯). Si ya está alterado, vuelve a natural."
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
                        ♯
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
                        title="Auto usa la armadura esperada (ej. F mayor → Bb, no A#)."
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
            </section>

            {/* MÁSTILES */}
            <div className="space-y-3">
              {showBoards.scale ? <Fretboard title="Escala" subtitle="Escala + (opcional) extras. Resalta raíz/3ª/5ª." mode="scale" /> : null}
              {showBoards.patterns ? <Fretboard title="Patrones" subtitle="Patrones: 5 boxes (pentatónicas), 7 3NPS (7 notas) y CAGED. Ruta: sigue la escala en orden y se restringe a patrones." mode="patterns" /> : null}
              {showBoards.route ? (
                <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-800">Ruta musical</div>
                  </div>
                  <div className="mt-2 grid gap-2 grid-cols-[150px_150px_220px_220px_220px]">
                    <div>
                      <label className={UI_LABEL_SM}>Inicio</label>
                      <input className={UI_INPUT_SM + " mt-1 w-full"} value={routeStartCode} onChange={(e) => setRouteStartCode(e.target.value)} />
                    </div>
                    <div>
                      <label className={UI_LABEL_SM}>Fin</label>
                      <input className={UI_INPUT_SM + " mt-1 w-full"} value={routeEndCode} onChange={(e) => setRouteEndCode(e.target.value)} />
                    </div>
                    <div>
                      <label className={UI_LABEL_SM}>Máx. notas seguidas/cuerda</label>
                      <select className={UI_SELECT_SM + " mt-1"} value={routeMaxPerString} onChange={(e) => setRouteMaxPerString(parseInt(e.target.value, 10))}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={UI_LABEL_SM}>Modo ruta</label>
                      <select className={UI_SELECT_SM + " mt-1"} value={routeMode} onChange={(e) => setRouteMode(e.target.value)}>
                        <option value="auto">Auto</option>
                        <option value="free">Libre</option>
                        <option value="pos">Posición/diagonal (slide)</option>
                        {(!isPentatonicScale && scaleIntervals.length === 7) ? <option value="nps">3NPS</option> : null}
                        {isPentatonicScale ? <option value="penta">Pentatónica (boxes)</option> : null}
                        <option value="caged">CAGED</option>
                      </select>
                    </div>
                    <div>
                      <label className={UI_LABEL_SM}>Patrón</label>
                      <select className={UI_SELECT_SM + " mt-1"} value={routeFixedPattern} onChange={(e) => setRouteFixedPattern(e.target.value)}>
                        <option value="auto">Auto</option>
                        {Array.from({ length: 7 }, (_, i) => i).map((i) => (
                          <option key={i} value={String(i)}>
                            {routeMode === "penta" ? `Box ${i + 1}` : routeMode === "caged" ? `CAGED ${i + 1}` : `Patrón ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ToggleButton active={routePreferNps} onClick={() => setRoutePreferNps((v) => !v)} title="Penaliza cambios de cuerda si aún no completas NPS">
                      Preferir NPS
                    </ToggleButton>
                    <ToggleButton active={routePreferVertical} onClick={() => setRoutePreferVertical((v) => !v)} title="Empuja a resolver bajando/subiendo en vertical si es viable">
                      Preferir vertical
                    </ToggleButton>
                    <ToggleButton active={routeKeepPattern} onClick={() => setRouteKeepPattern((v) => !v)} title="Intenta mantener la misma instancia de patrón si es posible">
                      Mantener patrón
                    </ToggleButton>
                    <ToggleButton active={allowPatternSwitch} onClick={() => setAllowPatternSwitch((v) => !v)} title="Permite cambiar de patrón durante la ruta">
                      Permite cambio patrón
                    </ToggleButton>

                    <div className="ml-2 flex items-center gap-2 text-xs text-slate-700">
                      <span className="font-semibold">Coste cambio</span>
                      <input
                        type="range"
                        min={0}
                        max={6}
                        step={0.5}
                        value={patternSwitchPenalty}
                        onChange={(e) => setPatternSwitchPenalty(parseFloat(e.target.value))}
                      />
                      <span className="tabular-nums">{patternSwitchPenalty.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-500">Click en el mástil de ruta para elegir: {routePickNext === "start" ? "Inicio" : "Fin"}.</div>
                </section>
              ) : null}
              {showBoards.route ? <Fretboard title="Ruta" subtitle="Ruta musical restringida a patrones (o libre)." mode="route" /> : null}

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
                        <div className="text-sm font-semibold text-slate-800">
                          Acorde
                          <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{chordEngineLayerLabel(chordEnginePlan)}</span>
                          <span className="ml-2 text-xs font-semibold text-slate-800">{chordSectionDisplayName}</span>
                          <span className="ml-2 text-xs font-normal text-slate-600">(Notas: {chordDetectMode ? (chordDetectSelectedNotesText || "—") : spelledChordNotes.join(", ")})</span>
                        </div>
                        <button
                          type="button"
                          className={UI_BTN_SM + " w-auto px-3"}
                          onClick={() => {
                            setStudyTarget("main");
                            setStudyOpen(true);
                          }}
                        >
                          Estudiar
                        </button>
                      </div>
                      <div className="grid items-stretch gap-2 grid-cols-[96px_210px_90px_200px_200px_130px_220px_56px]">
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
                                const letter = chordUiLetterFromPc(chordRootPc, false); // fuerza letra desde bemoles
                                const nat = mod12(NATURAL_PC[letter]);
                                const cur = mod12(chordRootPc);
                                if (cur !== nat) {
                                  // Si ya había alteración, vuelve a natural (sin “caminar” a otra letra)
                                  setChordRootPc(nat);
                                  setChordSpellPreferSharps(false);
                                  return;
                                }
                                setChordRootPc(mod12(nat - 1));
                                setChordSpellPreferSharps(false);
                              }}
                            >
                              ♭
                            </button>
                            <button
                              type="button"
                              className={`${UI_BTN_SM} ${chordAccidental && chordSpellPreferSharps ? "!bg-slate-900 !text-white !border-slate-900" : ""}`}
                              title="Subir 1 semitono"
                              onClick={() => {
                                const letter = chordUiLetterFromPc(chordRootPc, true); // fuerza letra desde sostenidos
                                const nat = mod12(NATURAL_PC[letter]);
                                const cur = mod12(chordRootPc);
                                if (cur !== nat) {
                                  // Si ya había alteración, vuelve a natural (sin “caminar” a otra letra)
                                  setChordRootPc(nat);
                                  setChordSpellPreferSharps(true);
                                  return;
                                }
                                setChordRootPc(mod12(nat + 1));
                                setChordSpellPreferSharps(true);
                              }}
                            >
                              ♯
                            </button>
                          </div>
                          
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Calidad / Sus</label>
                          <div className="mt-1 grid grid-cols-2 gap-1.5">
                            <select className={UI_SELECT_SM} value={chordQuality} onChange={(e) => setChordQuality(e.target.value)}>
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
                              className={UI_SELECT_SM}
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
                            <div className="mt-1 grid grid-cols-2 gap-1.5">
                              <select
                                className={UI_SELECT_SM}
                                value={chordPositionForm}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setChordPositionForm(v);
                                  if (!isDropForm(chordForm)) setChordForm(v);
                                }}
                                title="Posición del voicing: cerrado o abierto"
                              >
                                <option value="closed">Cerrado</option>
                                <option value="open">Abierto</option>
                              </select>
                              <select
                                className={UI_SELECT_SM}
                                value={dropFormFromEffectiveForm(chordForm)}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setChordForm(v === "none" ? chordPositionForm : v);
                                }}
                                title="Tipo de drop. Usa — para voicing libre"
                              >
                                {DROP_FORM_OPTIONS.map((form) => (
                                  <option
                                    key={form.value}
                                    value={form.value}
                                    disabled={form.value !== "none" && !chordEnginePlan.ui.dropEligible}
                                  >
                                    {form.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="mt-1 flex h-7 items-center rounded-xl border border-slate-200 bg-slate-100 px-2 text-xs text-slate-500">
                              Automática
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <label className={UI_LABEL_SM}>Inversión</label>
                          <select className={UI_SELECT_SM + " mt-1"} value={chordInversion} onChange={(e) => setChordInversion(e.target.value)}>
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
                            <label key={cand.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                              <input
                                type="radio"
                                name="detected-chord"
                                checked={chordDetectCandidateId === cand.id}
                                onChange={() => applyDetectedCandidate(cand)}
                                className="mt-0.5 h-4 w-4"
                              />
                              <div>
                                <div className="font-semibold text-slate-800">{cand.name}</div>
                                <div>{cand.intervalPairsText}</div>
                              </div>
                            </label>
                          )) : (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                              No hay lecturas claras todavía. Empieza con 3 o 4 notas.
                            </div>
                          )}
                        </div>
                      </section>
                    </>
                  ) : (
                    <ChordFretboard title="Acorde" voicing={activeChordVoicing} voicingIdx={chordVoicingIdx} voicingTotal={Math.max(1, chordVoicings.length)} />
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
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{chordEngineLayerLabel(r?.plan)}</span>
                                <span className="text-xs font-semibold text-slate-800">{chordName}</span>
                                <span className="text-xs font-normal text-slate-600">(Notas: {notes})</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className={UI_BTN_SM + " w-auto px-3"}
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
                                  >♭</button>
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
                                  >♯</button>
                                </div>
                              </div>

                              <div className="min-w-0">
                                <label className={UI_LABEL_SM}>Calidad / Sus</label>
                                <div className="mt-1 grid grid-cols-2 gap-1.5">
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
                                    updateNearSlot(idx, { structure: val, selFrets: null, ...patch });
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
                                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                                    <select
                                      className={UI_SELECT_SM}
                                      value={slot.positionForm || positionFormFromEffectiveForm(slot.form)}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        updateNearSlot(idx, {
                                          positionForm: v,
                                          form: isDropForm(slot.form) ? slot.form : v,
                                          selFrets: null,
                                        });
                                      }}
                                      disabled={disableAll}
                                      title="Posición del voicing: cerrado o abierto"
                                    >
                                      <option value="closed">Cerrado</option>
                                      <option value="open">Abierto</option>
                                    </select>
                                    <select
                                      className={UI_SELECT_SM}
                                      value={dropFormFromEffectiveForm(slot.form)}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        updateNearSlot(idx, {
                                          form: v === "none" ? (slot.positionForm || "closed") : v,
                                          selFrets: null,
                                        });
                                      }}
                                      disabled={disableAll}
                                      title="Tipo de drop. Usa — para voicing libre"
                                    >
                                      {DROP_FORM_OPTIONS.map((form) => (
                                        <option key={form.value} value={form.value} disabled={form.value !== "none" && !slotUi.dropEligible}>{form.label}</option>
                                      ))}
                                    </select>
                                  </div>
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
              <footer className="mt-6 flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-600">
          <span>Creado por: Jesus Quevedo Rodriguez</span>
          <span>{`ver. ${APP_VERSION}`}</span>
        </footer>
      </div>
    </div>
  );
}