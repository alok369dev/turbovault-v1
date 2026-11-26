// Checks a discount code against the cart so the customer sees it before paying.
const products = require('../products.json');
const { priceItems } = require('./_pricing'), { find } = require('./_discounts');
module.exports = (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { code, items } = req.body || {}, cart = priceItems(items, products);
  if (!cart) return res.status(400).json({ error: 'Invalid cart' });
  const d = find(code);
  if (!d) return res.status(404).json({ error: 'Invalid or expired discount code' });
  const sub = cart.priced.reduce((a, l) => a + l.price * l.qty, 0);
  if (sub < (d.minSubtotal || 0)) return res.status(400).json({ error: `Add ₹${d.minSubtotal - sub} more to use ${d.code}` });
  res.json({ code: d.code, type: d.type, value: d.value, minSubtotal: d.minSubtotal || 0 });
};
