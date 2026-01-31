"use client";

import React from "react";

export const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

export const IconLocations = () => (
  <Icon>
    <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </Icon>
);

export const IconBoxes = () => (
  <Icon>
    <path d="M21 16V8a2 2 0 00-1-1.73L13 3a2 2 0 00-2 0L4 6.27A2 2 0 003 8v8a2 2 0 001 1.73L11 21a2 2 0 002 0l7-3.27A2 2 0 0021 16z" />
    <path d="M7 9l5 3 5-3" />
  </Icon>
);

export const IconSearch = () => (
  <Icon>
    <circle cx="11" cy="11" r="6" />
    <path d="M21 21l-4.35-4.35" />
  </Icon>
);

export const IconLabels = () => (
  <Icon>
    <path d="M3 7v6a2 2 0 001 1.73L12 20l7-4.27A2 2 0 0020 14V8a2 2 0 00-1-1.73L12 2 4 6.27A2 2 0 003 7z" />
    <circle cx="8.5" cy="10.5" r="1.5" />
  </Icon>
);

export const IconScanQR = () => (
  <Icon>
    <rect x="3" y="3" width="5" height="5" />
    <rect x="16" y="3" width="5" height="5" />
    <rect x="3" y="16" width="5" height="5" />
    <path d="M14 14h2v2h-2z" />
  </Icon>
);

export const IconScanItem = () => (
  <Icon>
    <path d="M12 2v20" />
    <path d="M2 12h20" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const IconHome = () => (
  <Icon>
    <path d="M3 11l9-7 9 7" />
    <path d="M9 22V12h6v10" />
  </Icon>
);
