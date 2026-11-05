import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Retire the old generic offline cache; authenticated responses must stay private.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister()))
    )
    .catch(() => {});
  if ('caches' in window)
    void caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith('kenya-landlord-link') || key.startsWith('homara-atlas')
            )
            .map((key) => caches.delete(key))
        )
      )
      .catch(() => {});
}
createRoot(document.getElementById('root')!).render(<App />);
