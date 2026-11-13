import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Users,
  Rocket,
  Settings,
  User as UserIcon,
  MessageSquare,
  Compass,
  BookOpen,
  Wallet,
  Package,
  Briefcase,
  Heart,
  Banknote,
  Building,
  FileText,
  Info,
  HelpCircle,
  Shield,
  MapPin,
  Search,
  Plus,
  Target,
  TrendingUp,
  DollarSign,
  CheckCircle,
  Star,
  Calendar,
  Mail,
  BarChart3,
  CreditCard,
  Zap,
  Coins,
  Landmark,
  Bell,
  Lightbulb,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

export interface ContextAction {
  icon: LucideIcon;
  text: string;
}

export interface ContextContent {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  actions: ContextAction[];
  color: string;
  bgColor: string;
  bgIconClass: string;
}

interface RouteConfig extends ContextContent {
  matches: (pathname: string) => boolean;
}

const ROUTE_CONFIGS: RouteConfig[] = [
  {
    matches: p => p === '/' || p.startsWith(ROUTES.DASHBOARD.HOME),
    icon: Home,
    title: 'Your Dashboard',
    subtitle: 'Your personal command center',
    actions: [
      { icon: TrendingUp, text: 'Track your activity and progress' },
      { icon: MessageSquare, text: 'Connect with your network' },
      { icon: Plus, text: 'Create new projects or services' },
      { icon: BarChart3, text: 'View analytics and insights' },
    ],
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    bgIconClass: 'bg-sky-100',
  },
  {
    matches: p => p.startsWith('/profiles') || p.startsWith(ROUTES.DASHBOARD.INFO),
    icon: UserIcon,
    title: 'Your Profile',
    subtitle: 'Show the world who you are',
    actions: [
      { icon: UserIcon, text: 'Update your personal information' },
      { icon: MapPin, text: 'Set your location and availability' },
      { icon: FileText, text: 'Share your story and expertise' },
      { icon: Star, text: 'Highlight your achievements' },
    ],
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    bgIconClass: 'bg-sky-100',
  },
  {
    matches: p => p.startsWith('/timeline'),
    icon: BookOpen,
    title: 'Timeline',
    subtitle: 'Stay updated with your network',
    actions: [
      { icon: Plus, text: 'Share your latest updates' },
      { icon: MessageSquare, text: 'Engage with posts and discussions' },
      { icon: Users, text: 'Discover new connections' },
      { icon: Heart, text: 'Support causes you care about' },
    ],
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    bgIconClass: 'bg-green-100',
  },
  {
    matches: p => p.startsWith('/discover') || p.startsWith('/community'),
    icon: Compass,
    title: 'Discover',
    subtitle: 'Find projects and people',
    actions: [
      { icon: Search, text: 'Search for projects and people' },
      { icon: Users, text: 'Connect with like-minded individuals' },
      { icon: Target, text: 'Find opportunities and collaborations' },
      { icon: Star, text: 'Explore trending initiatives' },
    ],
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    bgIconClass: 'bg-sky-100',
  },
  {
    matches: p =>
      p.startsWith(ENTITY_REGISTRY['project'].basePath) ||
      p.startsWith(ENTITY_REGISTRY['project'].publicBasePath),
    icon: Rocket,
    title: 'Projects',
    subtitle: 'Bring your ideas to life',
    actions: [
      { icon: Plus, text: 'Start a new project' },
      { icon: Target, text: 'Set goals and track progress' },
      { icon: Users, text: 'Build your supporter community' },
      { icon: DollarSign, text: 'Manage funds and rewards' },
    ],
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    bgIconClass: 'bg-amber-100',
  },
  {
    matches: p => p.startsWith(ENTITY_REGISTRY['service'].basePath),
    icon: Briefcase,
    title: 'Services',
    subtitle: 'Offer your expertise',
    actions: [
      { icon: Plus, text: 'List your skills and services' },
      { icon: DollarSign, text: 'Set competitive pricing' },
      { icon: Calendar, text: 'Manage your availability' },
      { icon: Star, text: 'Build your reputation' },
    ],
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    bgIconClass: 'bg-teal-100',
  },
  {
    matches: p => p.startsWith(ENTITY_REGISTRY['cause'].basePath),
    icon: Heart,
    title: 'Causes',
    subtitle: 'Support what matters to you',
    actions: [
      { icon: Heart, text: 'Find causes you care about' },
      { icon: DollarSign, text: 'Make contributions that count' },
      { icon: Users, text: 'Join community initiatives' },
      { icon: Target, text: 'Track your impact' },
    ],
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    bgIconClass: 'bg-pink-100',
  },
  {
    matches: p => p.startsWith(ENTITY_REGISTRY['wallet'].basePath),
    icon: Wallet,
    title: 'Bitcoin Wallets',
    subtitle: 'Manage your digital assets',
    actions: [
      { icon: Coins, text: 'View your Bitcoin balance' },
      { icon: CreditCard, text: 'Send and receive payments' },
      { icon: Landmark, text: 'Connect external wallets' },
      { icon: BarChart3, text: 'Track your portfolio value' },
    ],
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    bgIconClass: 'bg-yellow-100',
  },
  {
    matches: p => p.startsWith('/assets'),
    icon: Package,
    title: 'Assets',
    subtitle: 'Manage your valuable possessions',
    actions: [
      { icon: Plus, text: 'Add new assets for collateral' },
      { icon: DollarSign, text: 'Get valuations and loans' },
      { icon: Shield, text: 'Secure your investments' },
      { icon: BarChart3, text: 'Track asset performance' },
    ],
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    bgIconClass: 'bg-emerald-100',
  },
  {
    matches: p => p.startsWith('/loans'),
    icon: Banknote,
    title: 'Peer-to-Peer Lending',
    subtitle: 'Borrow and lend Bitcoin',
    actions: [
      { icon: DollarSign, text: 'Apply for loans against assets' },
      { icon: TrendingUp, text: 'Earn interest by lending' },
      { icon: CheckCircle, text: 'Track repayment progress' },
      { icon: Shield, text: 'Secure, decentralized finance' },
    ],
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    bgIconClass: 'bg-amber-100',
  },
  {
    matches: p => p.startsWith('/groups') || p.startsWith(ENTITY_REGISTRY['group'].basePath),
    icon: Building,
    title: ENTITY_REGISTRY['group'].namePlural,
    subtitle: 'Build communities and governance',
    actions: [
      { icon: Plus, text: `Start an ${ENTITY_REGISTRY['group'].name.toLowerCase()}` },
      { icon: Users, text: 'Manage team members' },
      { icon: Target, text: 'Set collective goals' },
      { icon: CheckCircle, text: 'Vote on decisions' },
    ],
    color: 'text-fg-secondary',
    bgColor: 'bg-surface-raised/40',
    bgIconClass: 'bg-surface-raised',
  },
  {
    matches: p => p.startsWith('/messages'),
    icon: MessageSquare,
    title: 'Messages',
    subtitle: 'Connect and collaborate',
    actions: [
      { icon: Mail, text: 'Start new conversations' },
      { icon: Users, text: 'Join group discussions' },
      { icon: Zap, text: 'Get instant notifications' },
      { icon: Shield, text: 'Secure, private messaging' },
    ],
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    bgIconClass: 'bg-sky-100',
  },
  {
    matches: p => p.startsWith('/settings'),
    icon: Settings,
    title: 'Settings',
    subtitle: 'Customize your experience',
    actions: [
      { icon: UserIcon, text: 'Update your profile' },
      { icon: Shield, text: 'Manage privacy and security' },
      { icon: Bell, text: 'Configure notifications' },
      { icon: Zap, text: 'Optimize performance' },
    ],
    color: 'text-fg-secondary',
    bgColor: 'bg-surface-raised/40',
    bgIconClass: 'bg-surface-raised',
  },
  {
    matches: p => p.startsWith('/about'),
    icon: Info,
    title: 'About Orange Cat',
    subtitle: 'Learn about our mission',
    actions: [
      { icon: BookOpen, text: 'Read our story and values' },
      { icon: Users, text: 'Meet the team behind the vision' },
      { icon: Target, text: 'Understand our goals' },
      { icon: Heart, text: "See how we're making an impact" },
    ],
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    bgIconClass: 'bg-sky-100',
  },
  {
    matches: p => p.startsWith('/blog'),
    icon: FileText,
    title: 'Blog',
    subtitle: 'Stay informed and inspired',
    actions: [
      { icon: BookOpen, text: 'Read latest articles and updates' },
      { icon: TrendingUp, text: 'Learn about Bitcoin and finance' },
      { icon: Users, text: 'Discover community stories' },
      { icon: Lightbulb, text: 'Get inspired by new ideas' },
    ],
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    bgIconClass: 'bg-sky-100',
  },
  {
    matches: p => p.startsWith('/docs'),
    icon: BookOpen,
    title: 'Documentation',
    subtitle: 'Everything you need to know',
    actions: [
      { icon: Search, text: 'Find answers to your questions' },
      { icon: BookOpen, text: 'Read detailed guides' },
      { icon: Zap, text: 'Get started quickly' },
      { icon: HelpCircle, text: 'Access API documentation' },
    ],
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    bgIconClass: 'bg-green-100',
  },
];

const DEFAULT_CONTENT: ContextContent = {
  icon: Zap,
  title: 'Loading...',
  subtitle: 'Preparing your experience',
  actions: [
    { icon: Zap, text: 'Optimizing your experience' },
    { icon: CheckCircle, text: 'Loading personalized content' },
    { icon: Shield, text: 'Ensuring security and privacy' },
  ],
  color: 'text-fg-secondary',
  bgColor: 'bg-surface-raised/40',
  bgIconClass: 'bg-surface-raised',
};

export function getContextualContent(pathname: string): ContextContent {
  return ROUTE_CONFIGS.find(cfg => cfg.matches(pathname)) ?? DEFAULT_CONTENT;
}
