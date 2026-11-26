// Confirms the payment signature from Razorpay Checkout, then emails the confirmation.
const crypto = require('crypto');
const { sendConfirmation } = require('./_email');

module.exports = async (req, res) => {
  const id = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  const { razorpay_order_id: o, razorpay_payment_id: p, razorpay_signature: s } = req.body || {};
  if (!id || !secret || !o || !p || !s) return res.status(400).json({ error: 'Bad request' });
  const a = Buffer.from(crypto.createHmac('sha256', secret).update(o + '|' + p).digest('hex')), b = Buffer.from(String(s));
  if (!(a.length === b.length && crypto.timingSafeEqual(a, b))) return res.status(400).json({ error: 'Invalid signature' });
  let emailed = false;
  try { // an email problem must never undo a successful payment
    const r = await fetch('https://api.razorpay.com/v1/orders/' + encodeURIComponent(o), { headers: { Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64') } });
    if (r.ok) emailed = await sendConfirmation(await r.json(), p);
  } catch (e) { console.error('confirmation email failed', e); }
  res.json({ ok: true, emailed });
};
