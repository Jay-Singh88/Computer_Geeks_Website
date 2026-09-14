module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  if (req.query.token !== process.env.WEBHOOK_TOKEN) {
    res.status(401).send('Unauthorized');
    return;
  }

  const { triggerEvent, payload } = req.body || {};
  const REVIEW_LINK = 'https://g.page/r/CRjP0XnL8hifEBM/review';

  const known = {
    BOOKING_CREATED: { icon: '📅', label: 'New booking' },
    BOOKING_CANCELLED: { icon: '❌', label: 'Booking cancelled' },
    BOOKING_RESCHEDULED: { icon: '🔄', label: 'Booking rescheduled' },
    MEETING_ENDED: { icon: '✅', label: 'Session complete' }
  };

  const info = known[triggerEvent];
  if (!info) {
    res.status(200).send('Ignored');
    return;
  }

  const attendee = payload && payload.attendees && payload.attendees[0];
  let startStr = 'unknown time';
  if (payload && payload.startTime) {
    startStr = new Date(payload.startTime).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  const lines = [
    `${info.icon} ${info.label}`,
    '',
    payload && payload.title ? payload.title : 'Remote Support Session',
    `When: ${startStr} IST`
  ];
  if (attendee) lines.push(`Who: ${attendee.name} (${attendee.email})`);
  if (attendee && attendee.phone) lines.push(`Phone: ${attendee.phone}`);

  if (triggerEvent === 'MEETING_ENDED') {
    const firstName = attendee && attendee.name ? attendee.name.split(' ')[0] : 'there';
    const draft = `Hi ${firstName}, thanks for the session today! If you have 30 seconds, a quick Google review would really help us out: ${REVIEW_LINK}`;
    lines.push('', '⭐ Ask for a review now, while it\'s fresh — copy & send:', '---', draft, '---');
  }

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: lines.join('\n') })
  });

  res.status(200).send('OK');
};
