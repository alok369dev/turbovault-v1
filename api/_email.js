const settings = require('../settings.json');
const products = require('../products.json');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const join = (n, prefix) => Object.keys(n).filter(k => k.startsWith(prefix)).sort().map(k => n[k]).join('');

// Sends the confirmation to the customer (copy to the owner) using Resend. Returns true if sent.
exports.sendConfirmation = async (order, paymentId) => {
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM, owner = process.env.OWNER_EMAIL;
  const n = order.notes || {};
  if (!key || !from || !n.email) return false;
  const rows = join(n, 'items_').split('; ').filter(Boolean).map(s => {
    const m = s.match(/^(.*) x(\d+)$/), p = m && products.find(x => x.name === m[1]);
    return `<tr><td style="padding:6px 0">${esc(m ? m[1] : s)} × ${esc(m ? m[2] : 1)}</td><td align="right">${p ? inr(p.price * m[2]) : ''}</td></tr>`;
  }).join('');
  const line = (l, v, b) => `<tr><td style="padding:3px 0;${b ? 'font-weight:700;border-top:1px solid #ddd' : 'color:#666'}">${l}</td><td align="right" style="${b ? 'font-weight:700;border-top:1px solid #ddd' : 'color:#666'}">${v}</td></tr>`;
  const store = esc(settings.storeName || 'Store');
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">
<h2 style="margin:0 0 4px">Thank you, ${esc(n.name)}! 🏎️</h2><p style="margin:0 0 16px;color:#555">Your ${store} order is confirmed and payment was received.</p>
<table width="100%" cellspacing="0">${rows}${line('Subtotal', inr(n.subtotal || 0))}${n.discount ? line(`Discount (${esc(n.discount.split(':')[0])})`, '−' + inr(n.discount.split(':')[1])) : ''}${line('Shipping', Number(n.shipping) ? inr(n.shipping) : 'FREE')}${Number(n.gst) ? line(`Includes GST (${settings.gstRate}%)`, inr(n.gst)) : ''}${line('Total paid', inr(order.amount / 100), true)}</table>
<p><b>Shipping to</b><br>${esc(join(n, 'address_'))}<br>Phone: ${esc(n.phone)}</p>
<p style="color:#666;font-size:13px">Payment ID: ${esc(paymentId)}<br>Order ref: ${esc(order.receipt || order.id)}${settings.gstin ? '<br>GSTIN: ' + esc(settings.gstin) : ''}</p>
<p style="color:#666;font-size:13px">Questions? Just reply to this email.</p></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [n.email], bcc: owner ? [owner] : undefined, reply_to: owner || undefined, subject: `Order confirmed – ${settings.storeName || 'Store'} (${order.receipt || order.id})`, html })
  });
  return r.ok;
};
