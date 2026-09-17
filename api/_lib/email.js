async function sendInvoiceEmail({ to, invoiceNumber, totalFormatted, dueDate, payUrl, businessName }) {
  const subject = `Invoice ${invoiceNumber} from ${businessName || 'Computer Geeks'}`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h2 style="margin-bottom:4px">Invoice ${invoiceNumber}</h2>
      <p>Hi, here's your invoice${dueDate ? ` — due ${dueDate}` : ''}.</p>
      <p style="font-size:1.4rem;font-weight:700">${totalFormatted}</p>
      <p><a href="${payUrl}" style="display:inline-block;background:#2FE07E;color:#02150B;padding:12px 20px;border-radius:5px;text-decoration:none;font-weight:600">View &amp; pay invoice</a></p>
      <p style="color:#666;font-size:.9rem">Or copy this link: ${payUrl}</p>
    </div>
  `;

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
