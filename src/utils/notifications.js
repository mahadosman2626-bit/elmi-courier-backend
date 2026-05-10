async function sendPushNotification(tokens, title, body, data = {}) {
  const toList = Array.isArray(tokens) ? tokens : [tokens];
  const messages = toList
    .filter((t) => t && t.startsWith('ExponentPushToken['))
    .map((to) => ({ to, title, body, data, sound: 'default', priority: 'high' }));

  if (messages.length === 0) return;

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Expo push error:', text);
    }
  } catch (err) {
    console.error('Push notification failed:', err.message);
  }
}

module.exports = { sendPushNotification };
