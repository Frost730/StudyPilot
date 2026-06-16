import React from 'react';
import { GraduationCap, Rocket, Bot, Atom, BookOpen, User } from 'lucide-react';

export interface AvatarConfig {
  id: string;
  name: string;
  gradient: string;
  icon: React.ComponentType<any>;
}

export const AVATAR_PRESETS: AvatarConfig[] = [
  {
    id: 'default',
    name: 'Standard Scholar',
    gradient: 'from-violet-500 to-fuchsia-600',
    icon: User,
  },
  {
    id: 'scholar',
    name: 'Graduate Cap',
    gradient: 'from-emerald-400 to-teal-600',
    icon: GraduationCap,
  },
  {
    id: 'explorer',
    name: 'Space Explorer',
    gradient: 'from-sky-400 to-indigo-600',
    icon: Rocket,
  },
  {
    id: 'bot',
    name: 'AI Android',
    gradient: 'from-violet-500 to-purple-600',
    icon: Bot,
  },
  {
    id: 'chemist',
    name: 'Atomic Chemist',
    gradient: 'from-rose-400 to-pink-600',
    icon: Atom,
  },
  {
    id: 'bookworm',
    name: 'Bookworm',
    gradient: 'from-amber-400 to-orange-600',
    icon: BookOpen,
  },
];

export const getAvatarConfig = (avatarId: string | undefined): AvatarConfig => {
  return AVATAR_PRESETS.find((a) => a.id === avatarId) || AVATAR_PRESETS[0];
};

export const renderAvatar = (
  avatarId: string | undefined,
  userName: string | undefined,
  sizeClass = "h-9 w-9 text-xs"
) => {
  const config = getAvatarConfig(avatarId);
  const Icon = config.icon;

  // If standard/default avatar and we have a name, show the initial letter for extra personalization
  if (config.id === 'default' && userName) {
    const initial = userName.trim()[0].toUpperCase();
    return (
      <div className={`rounded-full bg-gradient-to-tr ${config.gradient} flex items-center justify-center text-white font-bold shadow-md select-none shrink-0 ${sizeClass}`}>
        {initial}
      </div>
    );
  }

  // Otherwise, render the custom preset icon
  // Determine inner icon size based on sizing class
  let iconSize = "h-4.5 w-4.5";
  if (sizeClass.includes("h-16")) iconSize = "h-8 w-8";
  else if (sizeClass.includes("h-8")) iconSize = "h-4 w-4";
  else if (sizeClass.includes("h-12")) iconSize = "h-6 w-6";
  else if (sizeClass.includes("h-10")) iconSize = "h-5 w-5";

  return (
    <div className={`rounded-full bg-gradient-to-tr ${config.gradient} flex items-center justify-center text-white shadow-md select-none shrink-0 ${sizeClass}`}>
      <Icon className={`${iconSize} stroke-[2.2]`} />
    </div>
  );
};
