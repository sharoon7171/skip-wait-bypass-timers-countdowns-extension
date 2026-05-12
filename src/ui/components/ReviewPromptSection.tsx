import { CHROME_WEB_STORE_LISTING_URL } from '../constants';

function StarIcon(): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-3 w-3 text-warning-600"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ExternalLinkIcon(): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function ReviewPromptSection(): React.ReactElement {
  return (
    <section
      className="overflow-hidden rounded-lg border border-warning-200/90 bg-gradient-to-br from-warning-50 via-white to-primary-50/80"
      aria-labelledby="review-prompt-heading"
    >
      <div className="flex flex-col gap-2.5 px-3 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-poppins text-[10px] font-bold text-warning-800">Chrome Web Store</p>
          <div
            className="inline-flex items-center gap-0 rounded-full bg-white/90 px-1.5 py-0.5 shadow-sm ring-1 ring-warning-200/80"
            aria-hidden
          >
            <StarIcon />
            <StarIcon />
            <StarIcon />
            <StarIcon />
            <StarIcon />
          </div>
        </div>
        <h2
          id="review-prompt-heading"
          className="font-poppins text-sm font-extrabold tracking-tight text-primary-950"
        >
          Enjoying Skip Wait?
        </h2>
        <p className="font-poppins text-xs font-medium leading-snug text-neutral-800">
          A quick star rating helps others find the extension.
        </p>
        <a
          href={CHROME_WEB_STORE_LISTING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-radius-button bg-primary-600 px-3 py-2 font-poppins text-xs font-bold text-white shadow-md transition-colors hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        >
          <ExternalLinkIcon />
          Rate on Chrome Web Store
        </a>
        <p className="text-center font-poppins text-[10px] font-bold text-neutral-600">
          Opens in a new tab · ~1&nbsp;min
        </p>
      </div>
    </section>
  );
}
