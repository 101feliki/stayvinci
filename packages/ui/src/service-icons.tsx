import {
  Bath,
  BedDouble,
  Brush,
  Coffee,
  Crown,
  Droplets,
  Dumbbell,
  Eye,
  Feather,
  Flame,
  Flower2,
  Footprints,
  Gem,
  Hand,
  HandHeart,
  HeartHandshake,
  Leaf,
  Moon,
  Palette,
  Scissors,
  ShowerHead,
  Smile,
  Snowflake,
  Sparkles,
  Sun,
  Users,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { cn } from './cn';

/** The Stayvinci icon set Houses can use on services instead of a photo. */
export const SERVICE_ICON_SET: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'sparkles', label: 'Glow', icon: Sparkles },
  { id: 'flower', label: 'Flower', icon: Flower2 },
  { id: 'hand', label: 'Hands', icon: Hand },
  { id: 'handheart', label: 'Care', icon: HandHeart },
  { id: 'flame', label: 'Hot stone', icon: Flame },
  { id: 'droplets', label: 'Oils', icon: Droplets },
  { id: 'leaf', label: 'Natural', icon: Leaf },
  { id: 'waves', label: 'Water', icon: Waves },
  { id: 'bath', label: 'Bath', icon: Bath },
  { id: 'shower', label: 'Steam', icon: ShowerHead },
  { id: 'wind', label: 'Breath', icon: Wind },
  { id: 'moon', label: 'Evening', icon: Moon },
  { id: 'sun', label: 'Morning', icon: Sun },
  { id: 'snow', label: 'Cool', icon: Snowflake },
  { id: 'feather', label: 'Gentle', icon: Feather },
  { id: 'gem', label: 'Luxury', icon: Gem },
  { id: 'crown', label: 'Signature', icon: Crown },
  { id: 'eye', label: 'Brows & lashes', icon: Eye },
  { id: 'smile', label: 'Facial', icon: Smile },
  { id: 'scissors', label: 'Hair', icon: Scissors },
  { id: 'brush', label: 'Make-up', icon: Brush },
  { id: 'palette', label: 'Colour', icon: Palette },
  { id: 'footprints', label: 'Feet', icon: Footprints },
  { id: 'dumbbell', label: 'Sports', icon: Dumbbell },
  { id: 'hearts', label: 'Couples', icon: HeartHandshake },
  { id: 'users', label: 'Group', icon: Users },
  { id: 'coffee', label: 'Lounge', icon: Coffee },
  { id: 'bed', label: 'Stay', icon: BedDouble },
];

export function serviceIcon(id: string | null): LucideIcon {
  return SERVICE_ICON_SET.find((x) => x.id === id)?.icon ?? Sparkles;
}

/**
 * The picture for a service: the House's photo, or a chosen icon on a soft brand
 * gradient. Use inside a sized, `relative overflow-hidden` box.
 */
export function ServiceVisual({
  image,
  icon,
  name,
  from,
  to,
  iconColor = '#F5F1E8',
  className,
}: {
  image: string | null;
  icon: string | null;
  name: string;
  from: string;
  to: string;
  iconColor?: string;
  className?: string;
}) {
  if (image)
    return (
      <img
        src={image}
        alt={name}
        loading="lazy"
        className={cn('h-full w-full object-cover', className)}
        draggable={false}
      />
    );
  const Icon = serviceIcon(icon);
  return (
    <div
      className={cn('flex h-full w-full items-center justify-center', className)}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-hidden
    >
      <Icon
        className="size-1/3 max-h-12 max-w-12 opacity-90"
        style={{ color: iconColor }}
        strokeWidth={1.4}
      />
    </div>
  );
}
