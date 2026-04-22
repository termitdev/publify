import { FC, ReactNode } from 'react';
import './marquee.css';

interface MarqueeProps {
  children: ReactNode;
  pauseOnHover?: boolean;
  reverse?: boolean;
  vertical?: boolean;
  className?: string;
}

const Marquee: FC<MarqueeProps> = ({ children, pauseOnHover, reverse, vertical, className }) => {
  return (
    <div
      className={`marquee ${vertical ? 'vertical' : 'horizontal'} ${reverse ? 'reverse' : ''} ${
        pauseOnHover ? 'pause-on-hover' : ''
      } ${className}`}
      style={{ overflow: 'hidden' }}
    >
      <div className="marquee-content" style={{ minWidth: vertical ? '100%' : '200%', minHeight: vertical ? '200%' : '100%' }}>
        {children}
        {children}
        {children} {/* Adiciona mais uma duplicação para maior fluidez */}
      </div>
    </div>
  );
};

export { Marquee };