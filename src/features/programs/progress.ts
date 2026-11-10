// Whole-number percent for progress bars. Empty program = 0.
export const percent = (done: number, total: number): number => (total === 0 ? 0 : Math.round((done / total) * 100));
