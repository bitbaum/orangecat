/**
 * One slide, rendered. Pure and server-safe: the same component draws a slide
 * full screen, in an editor's preview and as a thumbnail, because every length
 * in styles.css is relative to the frame.
 */

import type { CSSProperties, ReactNode } from 'react';
import { accentParts, leadParts } from '../text';
import type { Slide as SlideData, Theme } from '../types';

function Title({ text, big }: { text: string; big?: boolean }) {
  const Tag = big ? 'h1' : 'h2';
  return (
    <Tag className="dk-title">
      {accentParts(text).map((part, i) =>
        part.accent ? (
          <span key={i} className="dk-accent">
            {part.text}
          </span>
        ) : (
          part.text
        )
      )}
    </Tag>
  );
}

function Kicker({ text }: { text?: string }) {
  return text ? <p className="dk-kicker">{text}</p> : null;
}

function Bars({ bars }: { bars: NonNullable<SlideData['bars']> }) {
  const max = Math.max(1, ...bars.map(b => b.value));
  const last = bars.length - 1;
  // Selective direct labels: the largest bar and the latest one, never every bar.
  const peak = bars.reduce((best, b, i) => (b.value > bars[best]!.value ? i : best), 0);
  return (
    <div>
      <div
        className="dk-bars"
        role="img"
        aria-label={bars.map(b => `${b.label}: ${b.value}`).join(', ')}
      >
        {bars.map((bar, i) => (
          <div key={`${bar.label}-${i}`} className="dk-bar" title={`${bar.label}: ${bar.value}`}>
            {(i === peak || i === last) && bar.value > 0 && (
              <span className="dk-bar-value">{bar.value}</span>
            )}
            <div
              className="dk-bar-fill"
              style={{ height: `${bar.value === 0 ? 0 : Math.max(3, (bar.value / max) * 85)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="dk-bar-labels" aria-hidden>
        <span>{bars[0]?.label}</span>
        <span>{bars[last]?.label}</span>
      </div>
    </div>
  );
}

function Content({ slide }: { slide: SlideData }): ReactNode {
  switch (slide.layout) {
    case 'cover':
    case 'closing':
      return (
        <>
          <Kicker text={slide.kicker} />
          <Title text={slide.title} big={slide.layout === 'cover'} />
          {slide.body && <p className="dk-body">{slide.body}</p>}
          {slide.action && (
            <a className="dk-action" href={slide.action.href} rel="noreferrer" target="_blank">
              {slide.action.label}
            </a>
          )}
        </>
      );
    case 'points':
      return (
        <>
          <Kicker text={slide.kicker} />
          <Title text={slide.title} />
          {slide.points && (
            <ul className={`dk-points${slide.points.length > 3 ? ' dk-two' : ''}`}>
              {slide.points.map(point => {
                const { lead, rest } = leadParts(point);
                return (
                  <li key={point}>
                    {lead && <b>{lead}: </b>}
                    {rest}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      );
    case 'numbers':
      return (
        <>
          <Kicker text={slide.kicker} />
          <Title text={slide.title} />
          {slide.stats && (
            <div className={`dk-stats dk-n${slide.stats.length}`}>
              {slide.stats.map(stat => (
                <div key={stat.label} className="dk-stat">
                  <p className="dk-stat-value">{stat.value}</p>
                  <p className="dk-stat-label">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </>
      );
    case 'chart':
      return (
        <>
          <Kicker text={slide.kicker} />
          <Title text={slide.title} />
          {slide.bars && <Bars bars={slide.bars} />}
        </>
      );
    case 'compare':
    case 'columns':
      return (
        <>
          <Kicker text={slide.kicker} />
          <Title text={slide.title} />
          {slide.columns && (
            <div className={`dk-columns dk-n${Math.max(2, slide.columns.length)}`}>
              {slide.columns.map(column => (
                <div key={column.heading} className="dk-column">
                  <h3>{column.heading}</h3>
                  <ul>
                    {column.items.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      );
    case 'image':
      return (
        <>
          <div>
            <Kicker text={slide.kicker} />
            <Title text={slide.title} />
            {slide.body && <p className="dk-body">{slide.body}</p>}
          </div>
          {slide.image && (
            <div className="dk-browser">
              <div className="dk-browser-bar" aria-hidden>
                <i />
                <i />
                <i />
                <span>{slide.imageCaption}</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- owner-supplied https image on any host */}
              <img src={slide.image} alt={slide.imageCaption ?? ''} />
            </div>
          )}
        </>
      );
    default:
      return (
        <>
          <Kicker text={slide.kicker} />
          <Title text={slide.title} />
          {slide.body && <p className="dk-body">{slide.body}</p>}
        </>
      );
  }
}

export interface SlideProps {
  slide: SlideData;
  theme: Theme;
  /** Rise-in motion on entry (the presenter's active slide). */
  animate?: boolean;
  /** Hidden but still in the document (the presenter's other slides; shown when printing). */
  hidden?: boolean;
  className?: string;
}

export function Slide({ slide, theme, animate, hidden, className }: SlideProps) {
  return (
    <div
      className={`dk-frame dk-${theme.mode}${className ? ` ${className}` : ''}`}
      style={{ '--dk-accent': theme.accent, display: hidden ? 'none' : undefined } as CSSProperties}
      aria-hidden={hidden || undefined}
      data-slide-id={slide.id}
    >
      <section
        className={`dk-slide dk-layout-${slide.layout}${animate ? ' dk-animate' : ''}`}
        aria-roledescription="slide"
      >
        <Content slide={slide} />
      </section>
      {slide.sources && <p className="dk-sources">{slide.sources}</p>}
    </div>
  );
}
