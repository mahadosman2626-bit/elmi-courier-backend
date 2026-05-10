const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  listAvailableJobs,
  myJobs,
  getJob,
  createJob,
  acceptJob,
  markCollecting,
  markInTransit,
  deliverJob,
  cancelJob,
  rateJob,
} = require('../controllers/jobController');

// Drivers see the open job board
router.get('/', requireAuth, requireRole('DRIVER'), listAvailableJobs);

// Both roles see their own jobs
router.get('/my', requireAuth, myJobs);

// Single job — both roles
router.get('/:id', requireAuth, getJob);

// Business posts a job
router.post('/', requireAuth, requireRole('BUSINESS'), createJob);

// Driver actions
router.post('/:id/accept',     requireAuth, requireRole('DRIVER'), acceptJob);
router.post('/:id/collecting', requireAuth, requireRole('DRIVER'), markCollecting);
router.post('/:id/transit',    requireAuth, requireRole('DRIVER'), markInTransit);
router.post('/:id/deliver',    requireAuth, requireRole('DRIVER'), deliverJob);

// Either party can cancel
router.post('/:id/cancel', requireAuth, cancelJob);

// Either party can rate after delivery
router.post('/:id/rate', requireAuth, rateJob);

module.exports = router;
