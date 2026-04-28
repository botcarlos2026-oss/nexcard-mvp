import React, { useState } from 'react';
import { Instagram, Linkedin, Facebook, Youtube, Github, Globe, Twitter } from 'lucide-react';
import { detectLinkType, getFaviconUrl } from '../utils/linkIcons';

const LUCIDE_ICONS = {
  instagram: Instagram,
  linkedin: Linkedin,
  facebook: Facebook,
  youtube: Youtube,
  github: Github,
  twitter: Twitter,
};

const LABEL_ICONS = {
  whatsapp: '💬',
  telegram: '✈️',
  spotify: '🎵',
  twitch: '🎮',
  discord: '🗣️',
  pinterest: '📌',
  medium: '✍️',
  behance: '🎨',
  dribbble: '🎯',
  tiktok: '🎵',
  calendly: '📅',
};

export default function LinkIcon({ url, size = 24, className = '' }) {
  const [faviconError, setFaviconError] = useState(false);
  const { type, color } = detectLinkType(url);

  if (type === 'website') {
    const faviconUrl = getFaviconUrl(url);
    if (faviconUrl && !faviconError) {
      return (
        <img
          src={faviconUrl}
          alt="favicon"
          width={size}
          height={size}
          className={`rounded-sm object-contain ${className}`}
          onError={() => setFaviconError(true)}
        />
      );
    }
    return <Globe size={size} className={className} style={{ color }} />;
  }

  const LucideIcon = LUCIDE_ICONS[type];
  if (LucideIcon) {
    return <LucideIcon size={size} className={className} style={{ color }} />;
  }

  const emoji = LABEL_ICONS[type];
  if (emoji) {
    return (
      <span className={className} style={{ fontSize: size * 0.8, lineHeight: 1 }}>
        {emoji}
      </span>
    );
  }

  return <Globe size={size} className={className} style={{ color: '#71717A' }} />;
}
