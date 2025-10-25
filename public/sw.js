/**
 * Enhanced Service Worker for PWA features
 * Includes background sync, offline forms, and advanced caching
 */

const CACHE_NAME = 'kenya-landlord-link-v2';
const STATIC_CACHE_NAME = 'kenya-landlord-link-static-v2';
const DYNAMIC_CACHE_NAME = 'kenya-landlord-link-dynamic-v2';
const OFFLINE_FORMS_CACHE = 'kenya-landlord-link-forms-v1';

// Background sync queue for offline actions
const SYNC_QUEUE = 'background-sync-queue';

// Assets that should be cached indefinitely (with versioning)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/offline.html',
  '/browserconfig.xml'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Static assets cached successfully');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests (except for Supabase storage)
  if (url.origin !== location.origin && !url.origin.includes('supabase.co')) {
    return;
  }
  
  // Handle different types of requests
  if (isStaticAsset(request)) {
    // Static assets - cache first strategy
    event.respondWith(cacheFirst(request));
  } else if (isApiRequest(request)) {
    // Do not intercept API requests to avoid caching sensitive data
    return;
  } else {
    // HTML pages - network first strategy
    event.respondWith(networkFirst(request));
  }
});

// Background sync event - handle offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === SYNC_QUEUE) {
    event.waitUntil(processSyncQueue());
  }
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: 'kenya-landlord-link',
    data: {
      url: '/',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icon-192.svg'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Kenya Landlord Link', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

// Message event - handle updates and PWA features
self.addEventListener('message', (event) => {
  console.log('Service Worker message received:', event.data);
  
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.action === 'backgroundSync') {
    event.waitUntil(processSyncQueue());
  }
  
  if (event.data && event.data.action === 'cacheFormData') {
    event.waitUntil(cacheFormData(event.data.formData));
  }
});

// Helper functions
function isStaticAsset(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Include Supabase storage images
  if (url.origin.includes('supabase.co') && pathname.includes('/storage/')) {
    return true;
  }
  
  return pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/);
}

function isApiRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/');
}

// Cache first strategy for static assets
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Cache first strategy failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network first strategy for dynamic content
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/offline.html');
      return offlineResponse || new Response('Offline', { status: 503 });
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Background sync processing
async function processSyncQueue() {
  console.log('Processing background sync queue...');
  
  try {
    // Get queued actions from IndexedDB
    const queuedActions = await getQueuedActions();
    
    for (const action of queuedActions) {
      try {
        await processQueuedAction(action);
        await removeQueuedAction(action.id);
        console.log('Successfully processed queued action:', action.id);
      } catch (error) {
        console.error('Failed to process queued action:', action.id, error);
        // Keep the action in queue for retry
      }
    }
  } catch (error) {
    console.error('Background sync processing failed:', error);
  }
}

// Cache form data for offline use
async function cacheFormData(formData) {
  try {
    const cache = await caches.open(OFFLINE_FORMS_CACHE);
    const timestamp = Date.now();
    const cacheKey = `/offline-form-${timestamp}`;
    
    const response = new Response(JSON.stringify(formData), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=86400' // 24 hours
      }
    });
    
    await cache.put(cacheKey, response);
    console.log('Form data cached for offline use:', cacheKey);
    
    return { success: true, cacheKey };
  } catch (error) {
    console.error('Failed to cache form data:', error);
    return { success: false, error: error.message };
  }
}

// Get cached form data
async function getCachedFormData() {
  try {
    const cache = await caches.open(OFFLINE_FORMS_CACHE);
    const keys = await cache.keys();
    
    const formDataList = [];
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const data = await response.json();
        formDataList.push({
          url: request.url,
          data: data,
          timestamp: new Date(request.url.split('-').pop()).getTime()
        });
      }
    }
    
    return formDataList.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to get cached form data:', error);
    return [];
  }
}

// IndexedDB operations for background sync
async function getQueuedActions() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('KenyaLandlordLinkDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }
    };
  });
}

async function removeQueuedAction(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('KenyaLandlordLinkDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

async function processQueuedAction(action) {
  // Process different types of queued actions
  switch (action.type) {
    case 'property_listing':
      return await syncPropertyListing(action.data);
    case 'profile_update':
      return await syncProfileUpdate(action.data);
    case 'property_inquiry':
      return await syncPropertyInquiry(action.data);
    default:
      console.log('Unknown action type:', action.type);
  }
}

// Specific sync functions for different action types
async function syncPropertyListing(data) {
  // Sync property listing to server
  const response = await fetch('/api/properties', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to sync property listing: ${response.status}`);
  }
  
  return await response.json();
}

async function syncProfileUpdate(data) {
  // Sync profile update to server
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to sync profile update: ${response.status}`);
  }
  
  return await response.json();
}

async function syncPropertyInquiry(data) {
  // Sync property inquiry to server
  const response = await fetch('/api/inquiries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to sync property inquiry: ${response.status}`);
  }
  
  return await response.json();
}
