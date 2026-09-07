const SUPPORTED = new Map([
  ['full-time', 'full-time'],
  ['full time', 'full-time'],
  ['full-time permanent', 'full-time'],
  ['full time permanent', 'full-time'],
  ['full-time - remote', 'full-time'],
  ['full time - remote', 'full-time'],
  ['part-time', 'part-time'],
  ['part time', 'part-time'],
  ['contract', 'contract'],
  ['internship', 'internship'],
  ['intern', 'internship']
]);

export const mapExplicitLeverCommitment = value => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return SUPPORTED.get(normalized) ?? null;
};
