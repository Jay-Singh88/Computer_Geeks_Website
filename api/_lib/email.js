const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

async function sendInvoiceEmail({
  to, clientName, invoiceNumber, items, subtotalFormatted, taxFormatted, taxRatePercent,
  totalFormatted, dueDateFormatted, notes, payUrl, businessName
}) {
  const name = businessName || 'Computer Geeks';
  const subject = `Invoice ${invoiceNumber} from ${name} — ${totalFormatted} due`;

  const itemRows = (items || []).map((item) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #e4e9e6;color:#0b1a13">${esc(item.description)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e4e9e6;color:#5b6b62;text-align:center">${esc(item.quantity)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e4e9e6;color:#5b6b62;text-align:right">${item.unitPriceFormatted}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e4e9e6;color:#0b1a13;text-align:right;font-weight:600">${item.amountFormatted}</td>
    </tr>`).join('');

  const taxRow = taxFormatted
    ? `<tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#5b6b62">Tax (${taxRatePercent}%)</td><td style="padding:6px 8px;text-align:right;color:#0b1a13">${taxFormatted}</td></tr>`
    : '';

  const notesBlock = notes
    ? `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e4e9e6;color:#5b6b62;font-size:.92rem">${esc(notes).replace(/\n/g, '<br>')}</p>`
    : '';

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0b1a13">
    <div style="padding:4px 0 20px;border-bottom:2px solid #2FE07E;margin-bottom:24px">
      <img src="${process.env.SITE_URL}/assets/images/logo.png" alt="${esc(name)}" height="36" style="height:36px;width:auto;display:block">
    </div>

    <p style="margin:0 0 6px;font-size:1rem">Hi ${esc(clientName) || 'there'},</p>
    <p style="margin:0 0 20px;font-size:1rem;line-height:1.5">
      This is an invoice from ${esc(name)} for the service${(items || []).length > 1 ? 's' : ''} listed below.
      The total amount due is <strong>${totalFormatted}</strong>, payable by <strong>${dueDateFormatted}</strong> (Indian Standard Time).
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
      <thead>
        <tr>
          <th style="padding:8px;text-align:left;color:#5b6b62;font-size:.85rem;font-weight:600;border-bottom:2px solid #0b1a13">Service</th>
          <th style="padding:8px;text-align:center;color:#5b6b62;font-size:.85rem;font-weight:600;border-bottom:2px solid #0b1a13">Qty</th>
          <th style="padding:8px;text-align:right;color:#5b6b62;font-size:.85rem;font-weight:600;border-bottom:2px solid #0b1a13">Unit price</th>
          <th style="padding:8px;text-align:right;color:#5b6b62;font-size:.85rem;font-weight:600;border-bottom:2px solid #0b1a13">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#5b6b62">Subtotal</td><td style="padding:6px 8px;text-align:right;color:#0b1a13">${subtotalFormatted}</td></tr>
        ${taxRow}
        <tr><td colspan="3" style="padding:10px 8px 0;text-align:right;font-weight:700;font-size:1.05rem;border-top:1px solid #0b1a13">Total due</td><td style="padding:10px 8px 0;text-align:right;font-weight:700;font-size:1.05rem;border-top:1px solid #0b1a13">${totalFormatted}</td></tr>
      </tfoot>
    </table>

    <p style="margin:26px 0 18px;text-align:center">
      <a href="${payUrl}" style="display:inline-block;background:#2FE07E;color:#02150B;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:1rem">Pay ${totalFormatted} now</a>
    </p>
    <p style="color:#5b6b62;font-size:.85rem;text-align:center;margin:0 0 24px">
      Or copy this link into your browser:<br><a href="${payUrl}" style="color:#0b7a4a">${payUrl}</a>
    </p>
    ${notesBlock}
    <p style="margin-top:28px;padding-top:18px;border-top:1px solid #e4e9e6;color:#5b6b62;font-size:.85rem">
      Invoice ${esc(invoiceNumber)} · Due ${dueDateFormatted} IST · ${esc(name)} — remote IT automation, cyber security and support.
    </p>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to, subject, html })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}

module.exports = { sendInvoiceEmail };
