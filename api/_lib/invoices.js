function computeTotals(items, taxRatePercent) {
  const subtotalCents = items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0);
  const taxCents = Math.round((subtotalCents * (Number(taxRatePercent) || 0)) / 100);
  const totalCents = subtotalCents + taxCents;
  return { subtotalCents, taxCents, totalCents };
}

function isOverdue(invoice) {
  if (invoice.status !== 'sent' || !invoice.due_date) return false;
  const today = new Date(new Date().toDateString());
  return new Date(invoice.due_date) < today;
}

module.exports = { computeTotals, isOverdue };
