// Discount codes live here (server only). type: "percent" or "flat" (₹). expires: "YYYY-MM-DD" or null.
const list = [
  { code: 'TURBO10', type: 'percent', value: 10, minSubtotal: 0, expires: '2027-12-31' },
  { code: 'WELCOME50', type: 'flat', value: 50, minSubtotal: 299, expires: null }
];
exports.find = code => {
  const d = list.find(x => x.code === String(code || '').trim().toUpperCase());
  if (!d || (d.expires && Date.now() > Date.parse(d.expires + 'T23:59:59+05:30'))) return null;
  return d;
};
