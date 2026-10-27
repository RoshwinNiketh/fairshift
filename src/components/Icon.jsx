import React from 'react';

const paths = {
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  shield: <><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
  history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/></>,
  help: <><path d="M21 11a8 8 0 0 1-8 8H8l-5 3V11a9 9 0 0 1 18 0Z"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 2v.1"/></>,
  chevron: <path d="m8 10 4 4 4-4"/>,
  warning: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.1"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/></>,
};

export default function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.shield}</svg>;
}
