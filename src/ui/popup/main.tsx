import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { ReviewPromptSection } from '../components/ReviewPromptSection';
import { typography } from '../typography';
import { getRequestSupportUrl, CONTACT } from '../constants';
import '../global.css';

const REQUEST_SUPPORT_URL = getRequestSupportUrl();

function getExtensionIconUrl(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL('icon.png');
  }
  return '/icon.png';
}

function PopupPage(): React.ReactElement {
  return (
    <div className="box-border flex h-[600px] w-[800px] flex-col overflow-hidden bg-neutral-50 font-poppins">
      <Header title="Skip Wait" iconUrl={getExtensionIconUrl()} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
        <article className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-radius-card border border-neutral-200/90 bg-white shadow-sm">
          <div className="flex min-h-0 flex-1 flex-col justify-between gap-4 px-6 py-5">
            <section aria-labelledby="popup-summary-heading" className="shrink-0 text-left">
              <h2
                id="popup-summary-heading"
                className={`${typography.h2} text-lg font-extrabold tracking-tight text-primary-950 sm:text-xl`}
              >
                How it works
              </h2>
              <p className={`${typography.bodySm} mt-2 max-w-3xl leading-snug text-neutral-800`}>
                On supported link shorteners and file hosts, one click skips the countdown and takes you
                straight to the link.
              </p>
            </section>

            <section
              aria-labelledby="support-heading"
              className="shrink-0 border-t border-neutral-200 pt-4 text-left"
            >
              <h2
                id="support-heading"
                className={`${typography.h2} text-lg font-extrabold tracking-tight text-primary-950 sm:text-xl`}
              >
                Request a website
              </h2>
              <p className={`${typography.bodySm} mt-2 max-w-3xl leading-snug text-neutral-800`}>
                If a site shows a countdown or wait page we do not support yet, tell us the URL and what
                you see. We use that to add support. Use GitHub, or email or Telegram below.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <a
                  href={REQUEST_SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-radius-button bg-primary-600 px-4 py-2 font-poppins text-sm font-bold text-white shadow-sm hover:bg-primary-700 sm:py-2.5"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    className="h-4 w-4 shrink-0"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  Ask to add a website
                </a>
                <span className="hidden text-neutral-300 sm:inline" aria-hidden>
                  ·
                </span>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-700 hover:text-primary-800 hover:underline"
                  aria-label="Email"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  Email
                </a>
                <a
                  href={CONTACT.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-700 hover:text-primary-800 hover:underline"
                  aria-label="Telegram"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0"
                    aria-hidden
                  >
                    <path
                      fill="currentColor"
                      d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
                    />
                  </svg>
                  Telegram
                </a>
              </div>
            </section>

            <div className="shrink-0 border-t border-neutral-200 pt-4">
              <ReviewPromptSection />
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <PopupPage />
    </StrictMode>
  );
}
