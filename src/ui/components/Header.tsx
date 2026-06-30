type HeaderProps = {
  title: string;
  iconUrl?: string;
};

export function Header({ title, iconUrl }: HeaderProps): React.ReactElement {
  return (
    <header className="shrink-0 border-b border-primary-200 bg-primary-50 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="h-7 w-7 shrink-0" width={28} height={28} />
        ) : null}
        <h1 className="truncate font-poppins text-base font-black tracking-tight text-primary-900">
          {title}
        </h1>
      </div>
    </header>
  );
}
