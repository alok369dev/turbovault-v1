// Creates a Razorpay order. Prices, shipping and discounts are all worked out here, never trusted from the browser.
const products = require('../products.json');
const settings = require('../settings.json');
const { calc, priceItems } = require('./_pricing'), { find } = require('./_discounts');
const chunk = (s, n = 250) => s.match(new RegExp('.{1,' + n + '}', 'g')) || [''];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const id = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) return res.status(501).json({ error: 'Payments are not set up yet.' });

  const { items, customer: c = {}, code } = req.body || {};
  const cart = priceItems(items, products);
  if (!cart) return res.status(400).json({ error: 'Invalid cart' });
  for (const k of ['name', 'phone', 'email', 'address', 'city', 'pincode'])
    if (!String(c[k] || '').trim()) return res.status(400).json({ error: 'Missing ' + k });
  const pin = String(c.pincode).trim();
  if (!/^[1-9][0-9]{5}$/.test(pin)) return res.status(400).json({ error: 'Enter a valid 6-digit PIN code' });
  let d = null;
  if (code) { d = find(code); if (!d) return res.status(400).json({ error: 'Invalid or expired discount code' }); }
  const t = calc(cart.priced, settings, pin, d);
  if (d && !t.discount) return res.status(400).json({ error: `${d.code} needs a minimum order of ₹${d.minSubtotal}` });

  // Razorpay allows 15 note keys: 3 + up to 3 address + up to 4 items + 4 totals = 14
  const notes = { name: String(c.name).slice(0, 200), phone: String(c.phone).slice(0, 30), email: String(c.email).slice(0, 200),
    subtotal: String(t.subtotal), shipping: String(t.shipping), gst: String(t.gst) };
  if (d) notes.discount = d.code + ':' + t.discount;
  chunk(`${c.address}, ${c.city} - ${pin}`).slice(0, 3).forEach((s, i) => notes['address_' + (i + 1)] = s);
  chunk(cart.lines.join('; ')).slice(0, 4).forEach((s, i) => notes['items_' + (i + 1)] = s);

  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(t.total * 100), currency: 'INR', receipt: 'tv_' + Date.now(), notes })
  });
  const o = await r.json();
  if (!r.ok) return res.status(502).json({ error: (o.error && o.error.description) || 'Could not create order' });
  res.json({ orderId: o.id, amount: o.amount, currency: o.currency, key: id });
};
