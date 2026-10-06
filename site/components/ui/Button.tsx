import type { ReactNode } from 'react';
import Icon, { type IconName } from './Icon';

type Props = {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  icon?: IconName;
  trailingIcon?: IconName;
  external?: boolean;
};

const styles = {
  primary: 'bg-cyan text-ink hover:bg-white',
  ghost: 'border border-white/20 text-paper hover:border-white/50 hover:bg-white/5',
};

export default function Button({ href, children, variant = 'primary', icon, trailingIcon, external = true }: Props) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={`group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-[background-color,border-color,transform] duration-300 ease-out-expo hover:-translate-y-0.5 ${styles[variant]}`}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
      {trailingIcon && <Icon name={trailingIcon} size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />}
    </a>
  );
}
