import { typography } from '../typography';

const SQ_TECH_URL = 'https://www.sqtech.dev/';

export function Footer(): React.ReactElement {
  return (
    <footer className="shrink-0 border-t border-primary-200 px-4 py-1.5 sm:px-4 sm:py-2">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
        <span className={typography.caption}>
          Developed by{' '}
          <a
            href={SQ_TECH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-primary-700 hover:text-primary-800 hover:underline"
          >
            SQ Tech
          </a>
        </span>
      </div>
    </footer>
  );
}
