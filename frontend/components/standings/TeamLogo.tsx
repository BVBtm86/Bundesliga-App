/* eslint-disable @next/next/no-img-element */

type TeamLogoProps = {
  src?: string | null;
  name: string;
};

export function TeamLogo({ src, name }: TeamLogoProps) {
  if (!src) {
    return (
      <span className="grid size-7 place-items-center rounded-full bg-white text-[10px] font-black text-slate-950">
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return <img src={src} alt={name} width={30} height={30} className="size-7 object-contain" loading="lazy" />;
}
