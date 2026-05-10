const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT) || 12;

// Rough price estimate based on distance in miles
function estimatePrice(distanceMiles) {
  const base = 15;
  const perMile = 1.5;
  return Math.round((base + distanceMiles * perMile) * 100) / 100;
}

function calculateFees(totalPrice) {
  const platformFee = Math.round(totalPrice * (PLATFORM_FEE_PERCENT / 100) * 100) / 100;
  const driverEarnings = Math.round((totalPrice - platformFee) * 100) / 100;
  return { platformFee, driverEarnings };
}

module.exports = { estimatePrice, calculateFees };
