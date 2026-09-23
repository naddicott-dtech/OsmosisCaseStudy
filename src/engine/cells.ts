// Mini-lab calculations: single cell in a beaker, and water potential.

/** Osmolarity (mOsm/L) of an NaCl solution given in % (g per 100 mL). Uses osmotic coefficient 0.93. */
export function nacl_mOsm(percent: number): number {
  const molPerL = (percent * 10) / 58.44;
  return molPerL * 2 * 0.93 * 1000;
}

export const CELL_INSIDE_mOsm = 290;
/** Fraction of a red blood cell's volume that does not change with water (proteins, membrane). */
export const NON_OSMOTIC_FRACTION = 0.4;
export const RBC_LYSIS_RELATIVE_VOLUME = 1.6;
export const PLANT_WALL_RELATIVE_VOLUME = 1.08;

export type Tonicity = 'hypotonic' | 'isotonic' | 'hypertonic';

/** Tonicity of the solution relative to the cell, with a ±3% isotonic band. */
export function tonicity(outside_mOsm: number, inside_mOsm = CELL_INSIDE_mOsm): Tonicity {
  const r = outside_mOsm / inside_mOsm;
  if (r < 0.97) return 'hypotonic';
  if (r > 1.03) return 'hypertonic';
  return 'isotonic';
}

/** Boyle–van 't Hoff: equilibrium relative volume of a cell with no wall. Infinity in pure water. */
export function animalCellVolume(outside_mOsm: number): number {
  if (outside_mOsm <= 0) return Infinity;
  return (CELL_INSIDE_mOsm / outside_mOsm) * (1 - NON_OSMOTIC_FRACTION) + NON_OSMOTIC_FRACTION;
}

export type AnimalState = 'lysed' | 'swollen' | 'normal' | 'shrunken';

export function animalCellState(v: number): AnimalState {
  if (v >= RBC_LYSIS_RELATIVE_VOLUME) return 'lysed';
  if (v > 1.03) return 'swollen';
  if (v < 0.97) return 'shrunken';
  return 'normal';
}

export type PlantState = 'turgid' | 'normal' | 'plasmolyzed';

/** A plant cell's wall stops expansion, so it becomes turgid instead of bursting. */
export function plantCellVolume(outside_mOsm: number): number {
  return Math.min(PLANT_WALL_RELATIVE_VOLUME, animalCellVolume(outside_mOsm));
}

export function plantCellState(outside_mOsm: number): PlantState {
  const t = tonicity(outside_mOsm);
  if (t === 'hypotonic') return 'turgid';
  if (t === 'hypertonic') return 'plasmolyzed';
  return 'normal';
}

/** Solute potential Ψs = −iCRT in bars. C in mol/L, T in °C. */
export const R_L_BAR = 0.0831;
export function solutePotential(i: number, molPerL: number, tempC: number): number {
  const v = -i * molPerL * R_L_BAR * (tempC + 273.15);
  return v === 0 ? 0 : v; // avoid -0
}
