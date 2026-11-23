import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// The host may inject a badge in the bottom-right corner (Netlify's #nl-badge-frame).
// Leave room for it so it never covers the playback speed buttons.
const markBadge = () => document.body.classList.toggle('has-host-badge', !!document.getElementById('nl-badge-frame'));
new MutationObserver(markBadge).observe(document.body, { childList: true });
markBadge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
