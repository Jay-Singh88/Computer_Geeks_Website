module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const { name, business, email, phone, subject, message } = req.body || {};

  const lines = [
    '📩 New website enquiry',
    '',
    name ? `Name: ${name}` : null,
    business ? `Business: ${business}` : null,
    email ? `Email: ${email}` : null,
    phone ? `Phone: ${phone}` : null,
    subject ? `About: ${subject}` : null,
    message ? `Message: ${message}` : null
  ].filter(Boolean);

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: lines.join('\n') })
  });

  res.status(200).send('OK');
};
