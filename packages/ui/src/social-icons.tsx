import type { SVGProps } from 'react';

export type SocialNetwork = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'whatsapp';

export const SOCIAL_LABEL: Record<SocialNetwork, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
};

/** Brand colour of each network, for connect buttons. */
export const SOCIAL_COLOR: Record<SocialNetwork, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  x: '#111111',
  tiktok: '#111111',
  whatsapp: '#25D366',
};

/** Simple monochrome glyphs (currentColor) for linking to a House's social accounts. */
export function SocialIcon({
  network,
  ...props
}: { network: SocialNetwork } & SVGProps<SVGSVGElement>) {
  const common = {
    viewBox: '0 0 24 24',
    width: 20,
    height: 20,
    'aria-hidden': true,
    ...props,
  };
  switch (network) {
    case 'instagram':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'facebook':
      return (
        <svg {...common} fill="currentColor">
          <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.6V21h3z" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common} fill="currentColor">
          <path d="M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.9L17.8 3zm-1.1 16.2h1.7L7.3 4.7H5.5l11.2 14.5z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg {...common} fill="currentColor">
          <path d="M16.6 3c.3 2.2 1.6 3.6 3.9 3.8v3a7.2 7.2 0 0 1-3.8-1.2v6.2c0 3.5-2.6 6.2-6.1 6.2a6 6 0 0 1-6.1-6.1c0-3.6 3-6.3 6.8-5.9v3.2c-1.8-.4-3.4.8-3.4 2.6 0 1.6 1.2 2.8 2.7 2.8 1.7 0 2.8-1.2 2.8-3.2V3h3.2z" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2.5a9.4 9.4 0 0 0-8.1 14.2L2.5 21.5l4.9-1.3A9.4 9.4 0 1 0 12 2.5zm0 17.1c-1.5 0-2.9-.4-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A7.7 7.7 0 1 1 12 19.6zm4.3-5.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.3 6.3 0 0 1-3.1-2.7c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.7c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.7 2.6 4.1 3.6 1.5.7 2.1.7 2.9.6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.4-.3z" />
        </svg>
      );
  }
}
