import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function Button({ children, className, ...rest }: ButtonProps) {
  return (
    <button type="button" className={['button', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  );
}
