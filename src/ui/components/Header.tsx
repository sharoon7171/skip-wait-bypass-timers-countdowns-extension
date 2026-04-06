import { typography } from '../typography';

type HeaderProps = {
  title: string;
  iconUrl?: string;
};

export function Header({ title, iconUrl }: HeaderProps): React.ReactElement {
  return (
    <header className="shrink-0 border-b border-primary-200 bg-primary-50 px-4 py-1.5 sm:px-4 sm:py-2">
      <div className="flex items-center justify-center gap-2.5 sm:gap-3">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="h-7 w-7 shrink-0 sm:h-9 sm:w-9" width={36} height={36} />
        ) : null}
        <h1
          className={`${typography.h1} text-xl font-black tracking-tight text-primary-900 sm:text-3xl`}
        >
          {title}
        </h1>
      </div>
    </header>
  );
}
