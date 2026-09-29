// Change ringing, the maths the gothic edition is built on.
//
// A ring of 8 bells rings "rows": every bell once, in a different order each time. *Plain hunt on eight* swaps neighbouring
// bells (1-2)(3-4)(5-6)(7-8), then (2-3)(4-5)(6-7) with the two ends staying put, and so on; after 2 x 8 = 16 rows the bells
// come round to rounds (1 2 3 4 5 6 7 8) again. That is 16 rows x 8 strikes = 128 strikes - one per LED on the Klais-16 board -
// and the 16 rows are the 16 grids of its TM1640 driver (8 LEDs each), the 8 bells the 8 LEDs of a grid.
//
// Plain ES module (no node/browser APIs) so the synthesizer and the renderer use the very same table.

/** rows[r][p] = the bell (1..n) that rings in place p (0..n-1) of row r; rows[0] and rows[2n] are rounds */
export function plainHunt(n = 8) {
  const rows = [Array.from({ length: n }, (_, i) => i + 1)];
  for (let r = 1; r <= 2 * n; r++) {
    const next = rows[r - 1].slice();
    for (let i = r % 2 === 1 ? 0 : 1; i + 1 < n; i += 2) [next[i], next[i + 1]] = [next[i + 1], next[i]];
    rows.push(next);
  }
  return rows;
}

/** the place (0..n-1) a bell occupies in each row - its "blue line" */
export const bellPath = (rows, bell) => rows.map((row) => row.indexOf(bell));

/** firmware LED number (1..128) struck by `bell` in row `row` of a course: grid = row + 1, line = bell */
export const ledOf = (row, bell) => row * 8 + bell;
