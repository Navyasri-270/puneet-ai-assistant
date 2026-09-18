const CACHE_NAME = 'puneet-ai-v1';

// Install Event - Skip waiting immediately
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// Activate Event - Claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Web Push Event Handler
self.addEventListener('push', (event) => {
  let data = {
    title: '🔔 Puneet AI Assistant',
    body: 'You have pending tasks that require your attention.',
    url: '/tasks',
    tag: 'puneet-ai-tasks',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'puneet-ai-tasks',
    renotify: true,
    data: {
      url: data.url || '/tasks',
    },
    actions: [
      { action: 'view', title: 'View Tasks' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/tasks';

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/tasks') || client.url.includes(self.location.origin)) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client && !client.url.includes('/tasks')) {
              client.navigate(targetUrl);
            }
            return;
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
