'use client';

import { cn } from '@/lib/utils';

type ShinyTextProps = {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  color?: string;
  shineColor?: string;
};

/** React Bits–style metallic sheen across text. */
export default function ShinyText({
  text,
  disabled = false,
  speed = 3,
  className = '',
  color = '#78716c',
  shineColor = '#fff7ed',
}: ShinyTextProps) {
  return (
    <span
      className={cn('inline-block bg-clip-text text-transparent', className)}
      style={
        {
          backgroundImage: `linear-gradient(120deg, ${color} 0%, ${color} 40%, ${shineColor} 50%, ${color} 60%, ${color} 100%)`,
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: disabled ? undefined : `mkt-shine ${speed}s linear infinite`,
        } as React.CSSProperties
      }
    >
      {text}
    </span>
  );
}
