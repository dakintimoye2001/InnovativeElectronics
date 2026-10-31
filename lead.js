// Vercel serverless function: sends each quote request (and photos) to Telegram.
// Env vars needed in Vercel: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ ok: false, error: 'Missing env vars' });

  const d = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  if (!d.name || !d.phone || !d.devices) return res.status(400).json({ ok: false });

  const line = (label, v) => (v && String(v).length ? `<b>${label}:</b> ${esc(v)}\n` : '');
  const crack = Array.isArray(d.crackLocations) && d.crackLocations.length ? ` (${d.crackLocations.join(', ')})` : '';

  const text =
    '📱 <b>New Quote Request</b>\n\n' +
    line('Name', d.name) + line('Phone', d.phone) + line('Email', d.email) +
    line('Location', d.location) + line('Device(s)', d.devices) + '\n' +
    line('Unlocked', d.unlocked) + line('Carrier', d.carrier) +
    line('Cracked', (d.cracked || '') + crack) +
    line('All original parts', d.allOriginal) + line('Replaced parts', d.partsReplaced) +
    line('Battery', d.battery ? d.battery + '%' : '') +
    line('Notes', d.notes) + line('Photos', (d.photos || []).length);

  try {
    const api = `https://api.telegram.org/bot${token}`;

    const msg = await fetch(`${api}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    if (!msg.ok) throw new Error('sendMessage failed');

    const photos = (d.photos || []).slice(0, 8);
    if (photos.length === 1) {
      const fd = new FormData();
      fd.append('chat_id', chatId);
      fd.append('photo', new Blob([Buffer.from(photos[0], 'base64')], { type: 'image/jpeg' }), 'photo.jpg');
      await fetch(`${api}/sendPhoto`, { method: 'POST', body: fd });
    } else if (photos.length > 1) {
      const fd = new FormData();
      fd.append('chat_id', chatId);
      fd.append('media', JSON.stringify(photos.map((_, i) => ({ type: 'photo', media: `attach://p${i}` }))));
      photos.forEach((b64, i) => {
        fd.append(`p${i}`, new Blob([Buffer.from(b64, 'base64')], { type: 'image/jpeg' }), `p${i}.jpg`);
      });
      await fetch(`${api}/sendMediaGroup`, { method: 'POST', body: fd });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
};
