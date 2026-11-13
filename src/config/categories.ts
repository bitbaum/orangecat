interface Category {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  groups: {
    id: string;
    name: string;
    description: string;
    /**
     * A word that occurs in listings, for the tile's Discover search. The
     * display name searched as a phrase ("Medical Expenses") matched nothing.
     */
    searchTerm: string;
  }[];
}

interface SimpleCategory {
  value: string;
  label: string;
  icon: string;
  description: string;
}

export const categories: Category[] = [
  {
    id: 'health-life',
    name: 'Health & Life',
    description: 'For medical expenses, life events, and personal needs',
    icon: 'Heart',
    groups: [
      {
        id: 'medical',
        name: 'Medical Expenses',
        description: 'Medical treatments, procedures, and healthcare costs',
        searchTerm: 'medical',
      },
      {
        id: 'life-events',
        name: 'Life Events',
        description: 'Birth of a child, weddings, funerals, and other significant life moments',
        searchTerm: 'wedding',
      },
      {
        id: 'personal',
        name: 'Personal Needs',
        description: 'Personal emergencies, family support, and individual assistance',
        searchTerm: 'family',
      },
    ],
  },
  {
    id: 'creators',
    name: 'Creators',
    description: 'For content creators, artists, and digital creators',
    icon: 'Palette',
    groups: [
      {
        id: 'content-creators',
        name: 'Content Creators',
        description: 'Bloggers, YouTubers, podcasters, and social media creators',
        searchTerm: 'podcast',
      },
      {
        id: 'artists',
        name: 'Artists',
        description: 'Visual artists, musicians, DJs, and digital artists',
        searchTerm: 'art',
      },
      {
        id: 'writers',
        name: 'Writers',
        description: 'Authors, journalists, and independent writers',
        searchTerm: 'book',
      },
    ],
  },
  {
    id: 'builders',
    name: 'Builders',
    description: 'For developers, founders, and technical creators',
    icon: 'Code',
    groups: [
      {
        id: 'open-source',
        name: 'Open Source Developers',
        description: 'Maintainers and contributors to open source projects',
        searchTerm: 'open source',
      },
      {
        id: 'founders',
        name: 'Solo Founders',
        description: 'Independent entrepreneurs and startup founders',
        searchTerm: 'startup',
      },
      {
        id: 'vibe-coders',
        name: 'Vibe Coders',
        description: 'Creative developers and experimental projects',
        searchTerm: 'app',
      },
    ],
  },
  {
    id: 'education',
    name: 'Education',
    description: 'For students, teachers, and educational initiatives',
    icon: 'GraduationCap',
    groups: [
      {
        id: 'students',
        name: 'Students',
        description: 'Individual students and student projects',
        searchTerm: 'student',
      },
      {
        id: 'classes',
        name: 'Classes & Courses',
        description: 'Educational programs and course creators',
        searchTerm: 'course',
      },
      {
        id: 'educational-research',
        name: 'Educational Research',
        description: 'Academic research and educational initiatives',
        searchTerm: 'education',
      },
    ],
  },
  {
    id: 'research',
    name: 'Research',
    description: 'For decentralized science and independent researchers',
    icon: 'Microscope',
    groups: [
      {
        id: 'desci',
        name: 'Decentralized Science',
        description: 'DeSci projects and blockchain-based research initiatives',
        searchTerm: 'science',
      },
      {
        id: 'independent-research',
        name: 'Independent Researchers',
        description: 'Individual researchers and scientific investigations',
        searchTerm: 'research',
      },
      {
        id: 'scientific-studies',
        name: 'Scientific Studies',
        description: 'Research projects, experiments, and academic studies',
        searchTerm: 'study',
      },
    ],
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    description: 'For public works and community infrastructure projects',
    icon: 'Construction',
    groups: [
      {
        id: 'public-works',
        name: 'Public Works',
        description: 'Parks, bike lanes, roads, and public facilities',
        searchTerm: 'park',
      },
      {
        id: 'community-facilities',
        name: 'Community Facilities',
        description: 'Playgrounds, community centers, and shared spaces',
        searchTerm: 'community',
      },
      {
        id: 'urban-improvement',
        name: 'Urban Improvement',
        description: 'Pothole repairs, lighting, and city infrastructure upgrades',
        searchTerm: 'city',
      },
    ],
  },
  {
    id: 'environment',
    name: 'Environment',
    description: 'For environmental protection and sustainability projects',
    icon: 'TreePine',
    groups: [
      {
        id: 'cleanup-efforts',
        name: 'Cleanup Efforts',
        description: 'Beach cleanups, waste removal, and environmental restoration',
        searchTerm: 'cleanup',
      },
      {
        id: 'conservation',
        name: 'Conservation',
        description: 'Wildlife protection, habitat preservation, and biodiversity projects',
        searchTerm: 'wildlife',
      },
      {
        id: 'sustainability',
        name: 'Sustainability',
        description: 'Renewable energy, green technologies, and sustainable practices',
        searchTerm: 'energy',
      },
    ],
  },
  {
    id: 'organizations',
    name: 'Organizations',
    description: 'For non-profits, charities, and community initiatives',
    icon: 'Building2',
    groups: [
      {
        id: 'non-profits',
        name: 'Non-Profits',
        description: 'Registered non-profit organizations',
        searchTerm: 'nonprofit',
      },
      {
        id: 'charities',
        name: 'Charities',
        description: 'Charitable organizations and initiatives',
        searchTerm: 'charity',
      },
      {
        id: 'communities',
        name: 'Communities',
        description: 'Community projects and initiatives',
        searchTerm: 'local',
      },
    ],
  },
];

// Helper exports for different use cases - SINGLE SOURCE OF TRUTH

// Simple categories for form dropdowns and UI components
export const simpleCategories: SimpleCategory[] = [
  {
    value: 'health',
    label: 'Health',
    icon: '🏥',
    description: 'Medical expenses, treatments, procedures',
  },
  { value: 'creative', label: 'Creative', icon: '🎨', description: 'Art, music, writing' },
  { value: 'technology', label: 'Technology', icon: '💻', description: 'Apps, websites, tech' },
  { value: 'community', label: 'Community', icon: '🏘️', description: 'Local initiatives' },
  { value: 'education', label: 'Education', icon: '📚', description: 'Learning, courses' },
  { value: 'research', label: 'Research', icon: '🔬', description: 'DeSci, independent research' },
  {
    value: 'infrastructure',
    label: 'Infrastructure',
    icon: '🏗️',
    description: 'Parks, bike lanes, public works',
  },
  {
    value: 'environment',
    label: 'Environment',
    icon: '🌱',
    description: 'Cleanup, conservation, sustainability',
  },
  { value: 'charity', label: 'Community Support', icon: '❤️', description: 'Helping others' },
  { value: 'business', label: 'Business', icon: '🚀', description: 'Startups, ventures' },
  { value: 'personal', label: 'Personal', icon: '🌟', description: 'Personal goals' },
  { value: 'other', label: 'Other', icon: '✨', description: 'Everything else' },
];

// TypeScript union type for categories
export type CategoryValue = (typeof simpleCategories)[number]['value'];
