export const BASE = process.env.BASE_PATH ?? '/launchpad';
export const url = (path: string): string => `${BASE}${path}`;
