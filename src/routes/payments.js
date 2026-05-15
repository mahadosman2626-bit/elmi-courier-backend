const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  createCheckout, confirmJob,
  driverOnboard, driverOnboardStatus, driverWithdraw,
} = require('../controllers/paymentController');

// Business — create Stripe Checkout Session + pending job
router.post('/create-checkout', requireAuth, requireRole('BUSINESS'), createCheckout);

// Business — called after browser closes to verify payment and activate job
router.post('/confirm/:jobId', requireAuth, requireRole('BUSINESS'), confirmJob);

// Stripe success/cancel redirect pages (no auth — browser lands here)
router.get('/checkout-success', (req, res) => {
  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="font-family:-apple-system,sans-serif;text-align:center;padding:60px 20px;background:#f8f9fa">
        <div style="font-size:64px;margin-bottom:16px">✅</div>
        <h1 style="font-size:24px;color:#1a1a1a;margin-bottom:8px">Payment successful!</h1>
        <p style="color:#666;font-size:16px">Your job is now live. Return to the Elmi app.</p>
      </body>
    </html>
  `);
});

router.get('/checkout-cancel', (req, res) => {
  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="font-family:-apple-system,sans-serif;text-align:center;padding:60px 20px;background:#f8f9fa">
        <div style="font-size:64px;margin-bottom:16px">↩️</div>
        <h1 style="font-size:24px;color:#1a1a1a;margin-bottom:8px">Payment cancelled</h1>
        <p style="color:#666;font-size:16px">Return to the Elmi app to try again.</p>
      </body>
    </html>
  `);
});

// Driver — Stripe Connect onboarding
router.post('/driver/onboard',        requireAuth, requireRole('DRIVER'), driverOnboard);
router.get('/driver/onboard-status',  requireAuth, requireRole('DRIVER'), driverOnboardStatus);
router.post('/driver/withdraw',       requireAuth, requireRole('DRIVER'), driverWithdraw);

// Stripe redirect pages for Connect onboarding
router.get('/driver/onboard-return', (req, res) => {
  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="font-family:-apple-system,sans-serif;text-align:center;padding:60px 20px;background:#f8f9fa">
        <div style="font-size:64px;margin-bottom:16px">🏦</div>
        <h1 style="font-size:24px;color:#1a1a1a;margin-bottom:8px">Bank account connected!</h1>
        <p style="color:#666;font-size:16px">Return to the Elmi app to start receiving payouts.</p>
      </body>
    </html>
  `);
});

router.get('/driver/onboard-refresh', async (req, res) => {
  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="font-family:-apple-system,sans-serif;text-align:center;padding:60px 20px;background:#f8f9fa">
        <h1 style="font-size:24px;color:#1a1a1a;margin-bottom:8px">Session expired</h1>
        <p style="color:#666;font-size:16px">Return to the Elmi app and tap "Connect Bank Account" again.</p>
      </body>
    </html>
  `);
});

module.exports = router;
