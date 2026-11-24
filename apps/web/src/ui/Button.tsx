import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { IconName } from '@flurry/art';
import { Icon } from './Icon';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  loading?: boolean;
  icon?: IconName;
  children: ReactNode;
};

/** Ink-outlined game button. Loading keeps its width and label and adds a spinning snowflake. */
export function Button({ variant = 'secondary', size = 'md', loading = false, icon, children, className = '', disabled, ...rest }: Props) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${loading ? 'is-loading' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="btn-spin"><Icon name="snowflake" size={20} /></span> : icon && <Icon name={icon} size={20} />}
      <span>{children}</span>
    </button>
  );
}
