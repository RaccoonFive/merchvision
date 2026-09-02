type ItemIconProps = {
  icon?: string;
  className: string;
};

export function ItemIcon({ icon, className }: ItemIconProps) {
  return icon
    ? <img alt="" className={className} decoding="async" loading="lazy" src={icon} />
    : <div aria-hidden="true" className={className} />;
}
