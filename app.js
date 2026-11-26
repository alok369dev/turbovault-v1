const $ = s => document.querySelector(s), fmt = n => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 }), J = { 'Content-Type': 'application/json' };
let S = { gstRate: 0, shipping: { zones: [{ prefixes: ['*'], flat: 0, freeAbove: 0 }] } }, PRODUCTS = [], cats = [], cat = 'All', q = '', cart = {}, co = [], pin = '', disc = null, tt;
try { cart = JSON.parse(localStorage.getItem('tv-cart')) || {}; } catch (e) {}
const save = () => { try { localStorage.setItem('tv-cart', JSON.stringify(cart)); } catch (e) {} };
const P = id => PRODUCTS.find(p => p.id == id);
const cartItems = () => Object.entries(cart).map(([id, qty]) => ({ id: +id, qty }));
const lines = items => items.map(i => ({ p: P(i.id), qty: i.qty })).filter(l => l.p && l.p.price);
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 1800); };

// Same rules as api/_pricing.js (the server re-checks everything at payment time)
const zoneFor = p => {
  let best = null, len = -1;
  for (const z of S.shipping.zones) for (const x of z.prefixes) {
    if (x === '*') { if (len < 0) { best = z; len = 0; } } else if (p.startsWith(x) && x.length > len) { best = z; len = x.length; }
  }
  return best || S.shipping.zones[S.shipping.zones.length - 1];
};
const discOf = sub => !disc || sub < (disc.minSubtotal || 0) ? 0 : Math.min(sub, disc.type === 'percent' ? Math.round(sub * disc.value) / 100 : disc.value);
const calc = items => {
  const subtotal = lines(items).reduce((s, l) => s + l.p.price * l.qty, 0), discount = discOf(subtotal), net = subtotal - discount;
  const z = pin ? zoneFor(pin) : null, shipping = !z ? null : (!net || net >= z.freeAbove ? 0 : z.flat), total = net + (shipping || 0);
  const gst = S.gstRate ? Math.round(total * S.gstRate / (100 + S.gstRate) * 100) / 100 : 0; // prices include GST
  return { subtotal, discount, shipping, total, gst, more: shipping ? z.freeAbove - net : 0 };
};
const totalsHtml = c => `<div><span>Subtotal</span><span>${fmt(c.subtotal)}</span></div>${c.discount ? `<div><span>Discount (${disc.code})</span><span>−${fmt(c.discount)}</span></div>` : ''}<div><span>Shipping</span><span>${c.shipping === null ? 'Enter PIN code' : c.shipping ? fmt(c.shipping) : 'FREE'}</span></div>${S.gstRate && c.total && c.shipping !== null ? `<div><span>Includes GST (${S.gstRate}%)</span><span>${fmt(c.gst)}</span></div>` : ''}<div class="t"><span>Total</span><span>${fmt(c.total)}</span></div>${c.more ? `<p class="note">Add ${fmt(c.more)} more for free shipping</p>` : ''}`;

function chips() { $('#chips').innerHTML = cats.map(c => `<button class="chip ${c === cat ? 'on' : ''}" data-c="${c}">${c}</button>`).join(''); }
function show() {
  const L = PRODUCTS.filter(p => (cat === 'All' || p.category === cat) && p.name.toLowerCase().includes(q));
  $('#grid').innerHTML = L.length ? L.map(p => `<article class="card"><img src="${p.image}" alt="${p.name}" loading="lazy" data-id="${p.id}" style="background:${p.bg}"><div class="info"><div class="tag">${p.category}</div><h3>${p.name}</h3><div class="row"><span class="price">${p.price ? fmt(p.price) : 'Price on request'}</span></div>${p.price ? `<div class="btns"><button class="btn sm ghost" data-add="${p.id}">Add to cart</button><button class="btn sm" data-buy="${p.id}">Buy now</button></div>` : `<div class="btns"><button class="btn sm ghost" data-e="${p.id}">Enquire</button></div>`}</div></article>`).join('') : '<div class="empty">No cars match your search.</div>';
}
function renderCart() {
  const L = lines(cartItems());
  $('#count').textContent = L.reduce((s, l) => s + l.qty, 0);
  $('#lines').innerHTML = L.length ? L.map(({ p, qty }) => `<div class="ln"><img src="${p.image}" alt=""><div><b>${p.name}</b><span class="price">${fmt(p.price)}</span><div class="qty"><button data-dec="${p.id}">−</button><span>${qty}</span><button data-inc="${p.id}">+</button></div></div><button class="x" data-rm="${p.id}" aria-label="Remove">✕</button></div>`).join('') : '<div class="empty">Your cart is empty.</div>';
  $('#tot').innerHTML = `<div><span>Subtotal</span><span>${fmt(L.reduce((s, l) => s + l.p.price * l.qty, 0))}</span></div><p class="note">Shipping and discount codes are applied at checkout</p>`;
  $('#toCheckout').disabled = !L.length;
}
function setQty(id, n) { n = Math.min(10, n); if (n < 1) delete cart[id]; else cart[id] = n; save(); renderCart(); }
const panel = on => { $('#drawer').classList.toggle('on', on); $('#ov').classList.toggle('on', on); };
function refreshCheckout() {
  const c = calc(co);
  $('#sum').innerHTML = lines(co).map(l => `<div><span>${l.p.name} × ${l.qty}</span><span>${fmt(l.p.price * l.qty)}</span></div>`).join('') + totalsHtml(c);
  $('#payBtn').textContent = c.shipping === null ? 'Pay now' : 'Pay ' + fmt(c.total);
}
function openCheckout(items) {
  co = items; disc = null; panel(false);
  const v = $('#form').elements.pincode.value.trim(); pin = /^[1-9][0-9]{5}$/.test(v) ? v : '';
  $('#code').value = ''; $('#codeMsg').textContent = ''; refreshCheckout();
  $('#coMain').hidden = false; $('#done').hidden = true; $('#err').textContent = ''; $('#co').classList.add('on');
}
function closeAll() { panel(false); $('#co').classList.remove('on'); $('#lb').classList.remove('on'); }

async function pay(items, c) {
  const r = await fetch('/api/create-order', { method: 'POST', headers: J, body: JSON.stringify({ items, customer: c, code: disc ? disc.code : undefined }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Could not start payment');
  return new Promise((res, rej) => {
    new Razorpay({ key: d.key, amount: d.amount, currency: d.currency, order_id: d.orderId, name: 'TurboVault', description: 'Order payment',
      prefill: { name: c.name, email: c.email, contact: c.phone }, theme: { color: '#e0b84a' },
      handler: async resp => {
        const v = await fetch('/api/verify-payment', { method: 'POST', headers: J, body: JSON.stringify(resp) });
        const vj = await v.json().catch(() => ({}));
        v.ok ? res({ ...resp, emailed: vj.emailed }) : rej(new Error('Payment could not be verified. Contact us with ID ' + resp.razorpay_payment_id));
      },
      modal: { ondismiss: () => rej(new Error('Payment cancelled')) } }).open();
  });
}
$('#form').onsubmit = async e => {
  e.preventDefault(); const f = e.target; f.classList.add('t');
  if (!f.checkValidity()) { $('#err').textContent = 'Please fill all fields correctly.'; return; }
  const btn = $('#payBtn'), c = Object.fromEntries(new FormData(f)); btn.disabled = true; btn.textContent = 'Please wait…'; $('#err').textContent = '';
  try {
    const resp = await pay(co.map(i => ({ id: i.id, qty: i.qty })), c);
    if (co.length === Object.keys(cart).length && co.every(i => cart[i.id] === i.qty)) { cart = {}; save(); renderCart(); }
    $('#pid').textContent = 'Payment ID: ' + resp.razorpay_payment_id + (resp.emailed ? ' · Confirmation sent to ' + c.email : '');
    $('#coMain').hidden = true; $('#done').hidden = false; f.reset(); f.classList.remove('t'); disc = null; pin = '';
  } catch (err) { $('#err').textContent = err.message; }
  btn.disabled = false; refreshCheckout();
};
$('#form').elements.pincode.addEventListener('input', e => { const v = e.target.value.trim(); pin = /^[1-9][0-9]{5}$/.test(v) ? v : ''; refreshCheckout(); });
$('#applyCode').onclick = async () => {
  const code = $('#code').value.trim(), m = $('#codeMsg'); if (!code) return;
  m.textContent = 'Checking…';
  try {
    const r = await fetch('/api/apply-code', { method: 'POST', headers: J, body: JSON.stringify({ code, items: co.map(i => ({ id: i.id, qty: i.qty })) }) });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Invalid code');
    disc = d; m.textContent = '✓ ' + d.code + ' applied';
  } catch (err) { disc = null; m.textContent = err.message; }
  refreshCheckout();
};
$('#code').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#applyCode').click(); } };

$('#chips').onclick = e => { if (e.target.dataset.c) { cat = e.target.dataset.c; chips(); show(); } };
$('#q').oninput = e => { q = e.target.value.toLowerCase().trim(); show(); };
$('#grid').onclick = e => {
  const d = e.target.dataset;
  if (d.add) { setQty(d.add, (cart[d.add] || 0) + 1); toast('Added to cart'); }
  else if (d.buy) openCheckout([{ id: +d.buy, qty: 1 }]);
  else if (d.e) location.href = 'mailto:?subject=' + encodeURIComponent('Enquiry: ' + P(d.e).name);
  else if (d.id) { const p = P(d.id); $('#lb img').src = p.image; $('#lb p').textContent = p.name; $('#lb').classList.add('on'); }
};
$('#lines').onclick = e => {
  const d = e.target.dataset;
  if (d.inc) setQty(d.inc, cart[d.inc] + 1); else if (d.dec) setQty(d.dec, cart[d.dec] - 1); else if (d.rm) setQty(d.rm, 0);
};
$('#openCart').onclick = () => panel(true);
$('#toCheckout').onclick = () => openCheckout(cartItems());
$('#ov').onclick = closeAll; $('#lb').onclick = closeAll;
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeAll(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

Promise.all([fetch('products.json').then(r => r.json()), fetch('settings.json').then(r => r.json())]).then(([d, s]) => {
  S = s; PRODUCTS = d; cats = ['All', ...new Set(d.map(p => p.category))];
  Object.keys(cart).forEach(id => { if (!P(id) || !P(id).price) delete cart[id]; });
  chips(); show(); renderCart();
}).catch(() => { $('#grid').innerHTML = '<div class="empty">Could not load products. Serve the site over http (see README).</div>'; });
