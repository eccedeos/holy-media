import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Botao base no padrao shadcn/ui (cva + cn), escrito a mao em vez de instalado
 * via CLI: o app precisa de poucos primitivos e cada dependencia custa bundle.
 * `components.json` continua presente para que `pnpm dlx shadcn@latest add ...`
 * funcione quando um componente maior valer a pena.
 *
 * Alvos de toque grandes por decisao de produto: o operador clica no escuro,
 * com pressa, muitas vezes durante o culto.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ' +
    'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent] ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[--color-accent] text-[--color-accent-content] hover:opacity-90',
        outline:
          'border border-[--color-border-subtle] bg-transparent hover:bg-[--color-surface-raised]',
        ghost: 'bg-transparent hover:bg-[--color-surface-raised]',
        live: 'bg-[--color-live] text-[--color-accent-content] hover:opacity-90',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
