# TurboVault

Static storefront with cart, buy now and Razorpay checkout. *Drive · Dream · Own.*

## Files
- `index.html`, `style.css`, `app.js` – the site (cart, checkout, filters)
- `settings.json` – **GST rate, shipping charge, free-shipping limit, GSTIN**. Set `gstRate` to 0 to hide GST.
- `products.json` – **your product list** (name, category, price in ₹, image). Prices here are what customers are charged.
- `api/_discounts.js` – **discount codes** (percent or flat ₹, minimum order, expiry)
- `api/apply-code.js` – checks a code for the customer
- `api/create-order.js` – creates the Razorpay order (price is re-checked on the server)
- `api/verify-payment.js` – verifies the payment signature
- `images/` – product photos and hero banner

## Set up payments
1. Create a Razorpay account and copy your **Test** keys (Dashboard → Account & Settings → API Keys).
2. In Vercel: Project → Settings → Environment Variables, add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, then Redeploy.
3. Test with Razorpay test cards/UPI. For real money, complete Razorpay KYC and swap in the **Live** keys.

## Shipping, GST, discounts, emails
- Shipping varies by PIN code. In `settings.json` each zone lists PIN `prefixes` (e.g. `"400"` = PINs starting 400; the longest match wins; `"*"` is everywhere else), a `flat` charge and a `freeAbove` limit. The sample zones are examples: edit them for where you ship from.
- Discount codes are in `api/_discounts.js`. One code per order; discounts apply to the products, not shipping; free shipping is judged after the discount.
- Prices are GST-inclusive. The checkout shows the GST contained in the total. Shipping (`flat`) is added unless the subtotal reaches `freeAbove`.
- Confirmation emails use Resend: add `RESEND_API_KEY`, `MAIL_FROM` (an address on a domain you verified in Resend) and `OWNER_EMAIL` (gets a copy) in Vercel. Without them, orders still work but no email is sent.

Customer name, phone, address and items are saved in each order's notes — view them in the Razorpay dashboard under Payments/Orders.

## Run locally
`npx vercel dev` (runs the site and the `api/` functions). Opening `index.html` directly will not load products.

## Edit products
Edit `products.json`. Set `price` to a number, or `null` to show "Price on request" with an Enquire button.
