export function subHours(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export function subDays(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
