import { cn } from '@/lib/utils';
import './card-agent.css';

/**
 * The card agent's robot, ported from the VCFO Assist extension (`extensions/vcfo-assist/src/ui/Robot.tsx`).
 * `idle` blinks and bobs its antenna; `working` bounces, scans its eyes and pulses the antenna
 * light; `done` smiles; `blocked` greys out. The colour is the agent's data token. All motion
 * stops under prefers-reduced-motion and the shell's own reduce-motion switch (card-agent.css).
 *
 * With a `label` the robot is an image with that name; without one it is decoration and hidden
 * from assistive technology (the control beside it carries the name).
 */
export type RobotMood = 'idle' | 'working' | 'done' | 'blocked';

export function Robot({
  color,
  mood = 'idle',
  size = 56,
  label,
  className,
}: {
  color: string;
  mood?: RobotMood;
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      className={cn('ca-robot', `ca-robot-${mood}`, className)}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: 'false' })}
      style={{ ['--robot' as string]: color }}
    >
      <g className="ca-robot-antenna">
        <line x1="32" y1="5" x2="32" y2="14" stroke="var(--robot)" strokeWidth="2.5" strokeLinecap="round" />
        <circle className="ca-robot-bulb" cx="32" cy="5" r="3.5" fill="var(--robot)" />
      </g>
      <g className="ca-robot-body">
        <rect x="11" y="14" width="42" height="30" rx="10" fill="var(--robot)" />
        <rect x="16" y="19" width="32" height="20" rx="7" fill="var(--robot-face)" />
        <g className="ca-robot-eyes">
          {mood === 'done' ? (
            <>
              <path d="M22 29 q3 -4 6 0" stroke="var(--robot)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M36 29 q3 -4 6 0" stroke="var(--robot)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <rect className="ca-robot-eye" x="22" y="25" width="6" height="7" rx="3" fill="var(--robot)" />
              <rect className="ca-robot-eye" x="36" y="25" width="6" height="7" rx="3" fill="var(--robot)" />
            </>
          )}
        </g>
        <path d={mood === 'blocked' ? 'M27 36 h10' : 'M27 35 q5 3 10 0'} stroke="var(--robot)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <rect x="6" y="24" width="5" height="10" rx="2.5" fill="var(--robot)" />
        <rect x="53" y="24" width="5" height="10" rx="2.5" fill="var(--robot)" />
        <rect x="20" y="46" width="24" height="12" rx="5" fill="var(--robot)" opacity="0.85" />
        <circle className="ca-robot-gear" cx="32" cy="52" r="3" fill="var(--robot-face)" />
      </g>
    </svg>
  );
}
