// Shared price maths. Product prices already include GST; shipping is added on top.
exports.priceItems = (items, products) => {
  if (!Array.isArray(items) || !items.length || items.length > 50) return null;
  const priced = [], lines = [];
  for (const it of items) {
    const p = it && products.find(x => x.id === it.id), qty = it && Math.floor(it.qty);
    if (!p || !p.price || !(qty >= 1 && qty <= 10)) return null;
    priced.push({ price: p.price, qty }); lines.push(p.name + ' x' + qty);
  }
  return { priced, lines };
};
// Longest matching PIN prefix wins; "*" is the fallback zone.
const zoneFor = (pin, zones) => {
  let best = null, len = -1;
  for (const z of zones) for (const x of z.prefixes) {
    if (x === '*') { if (len < 0) { best = z; len = 0; } }
    else if (String(pin).startsWith(x) && x.length > len) { best = z; len = x.length; }
  }
  return best || zones[zones.length - 1];
};
const discountOf = (d, sub) => !d || sub < (d.minSubtotal || 0) ? 0 : Math.min(sub, d.type === 'percent' ? Math.round(sub * d.value) / 100 : d.value);
exports.calc = (lines, s, pin, d) => {
  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const discount = discountOf(d, subtotal), net = subtotal - discount, z = zoneFor(pin, s.shipping.zones);
  const shipping = !net || net >= z.freeAbove ? 0 : z.flat, total = net + shipping;
  const gst = s.gstRate ? Math.round(total * s.gstRate / (100 + s.gstRate) * 100) / 100 : 0;
  return { subtotal, discount, shipping, total, gst };
};
