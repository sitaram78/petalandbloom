export const occasions = [
  {
    name: 'Birthday',
    description: 'For their special day.',
    image: '/placeholder-bloom.svg',
    filter: 'Birthday',
    color: 'bg-rose-200',
    textColor: 'text-rose-700',
    icon: 'Gift',
    slug: 'birthday',
    tags: ['Birthday'],
    descriptionLong: 'For their special day.',
    imageAlt: 'Wrapped bouquet for a birthday gift',
    emoji: 'Gift',
    emojiColor: 'text-rose-600',
    emojiBg: 'bg-rose-100',
  },
  {
    name: 'Anniversary',
    description: 'For something that lasts.',
    image: '/placeholder-bloom.svg',
    filter: 'Anniversary',
    color: 'bg-terracotta-200',
    textColor: 'text-terracotta-700',
    icon: 'Heart',
    slug: 'anniversary',
    tags: ['Anniversary'],
    descriptionLong: 'For something that lasts.',
    imageAlt: 'Elegant red flower bouquet for an anniversary',
    emoji: 'Heart',
    emojiColor: 'text-terracotta-600',
    emojiBg: 'bg-terracotta-100',
  },
  {
    name: 'Friendship',
    description: 'For your favourite person.',
    image: '/placeholder-bloom.svg',
    filter: 'Friendship',
    color: 'bg-sage-200',
    textColor: 'text-sage-700',
    icon: 'Users',
    slug: 'friendship',
    tags: ['Friendship'],
    descriptionLong: 'For your favourite person.',
    imageAlt: 'Wrapped bouquet for a friend',
    emoji: 'Users',
    emojiColor: 'text-sage-600',
    emojiBg: 'bg-sage-100',
  },
  {
    name: 'Just Because',
    description: 'No occasion needed.',
    image: '/placeholder-bloom.svg',
    filter: 'Just Because',
    color: 'bg-cream-300',
    textColor: 'text-brown-600',
    icon: 'Sparkles',
    slug: 'just-because',
    tags: ['Just Because'],
    descriptionLong: 'No occasion needed.',
    imageAlt: 'Gerbera daisy bouquet wrapped in hand',
    emoji: 'Sparkles',
    emojiColor: 'text-gold-600',
    emojiBg: 'bg-gold-200',
  },
  {
    name: "Mother's Day",
    description: 'A little handmade love.',
    image: '/placeholder-bloom.svg',
    filter: "Mother's Day",
    color: 'bg-rose-200',
    textColor: 'text-rose-700',
    icon: 'Flower2',
    slug: 'mothers-day',
    tags: ["Mother's Day"],
    descriptionLong: 'A little handmade love.',
    imageAlt: 'Flower bouquet for Mother\'s Day',
    emoji: 'Flower2',
    emojiColor: 'text-rose-600',
    emojiBg: 'bg-rose-100',
  },
  {
    name: 'Festivals',
    description: 'Thoughtful festive gifting.',
    image: '/placeholder-bloom.svg',
    filter: 'Festivals',
    color: 'bg-gold-200',
    textColor: 'text-gold-600',
    icon: 'Sparkle',
    slug: 'festivals',
    tags: ['Festivals'],
    descriptionLong: 'Thoughtful festive gifting.',
    imageAlt: 'Festive flower bouquet wrapped in gift paper',
    emoji: 'Sparkle',
    emojiColor: 'text-gold-600',
    emojiBg: 'bg-gold-200',
  },
  {
    name: "Valentine's Day",
    description: 'The ultimate expression of love.',
    image: '/placeholder-bloom.svg',
    filter: "Valentine's Day",
    color: 'bg-rose-400',
    textColor: 'text-rose-800',
    icon: 'Heart',
    slug: 'valentines-day',
    tags: ["Valentine's Day"],
    descriptionLong: 'The ultimate expression of love.',
    imageAlt: 'Red roses for Valentine\'s Day',
    emoji: 'Heart',
    emojiColor: 'text-rose-600',
    emojiBg: 'bg-rose-100',
  },
];

export const budgetFilters = [
  { label: 'Under ₹300', min: 0, max: 299, param: 'under-300' },
  { label: 'Under ₹500', min: 0, max: 500, param: 'under-500' },
  { label: 'Under ₹1,000', min: 0, max: 1000, param: 'under-1000' },
  { label: 'Under ₹1,500', min: 0, max: 1500, param: 'under-1500' },
  { label: 'Premium ₹2,000+', min: 2000, max: 99999, param: 'premium' },
];

export const howItWorksSteps = [
  { num: '01', label: 'Choose your piece', desc: 'Browse our collection or start a custom order.' },
  { num: '02', label: 'Choose your colours', desc: 'Pick from our palette or request something custom.' },
  { num: '03', label: 'We handcraft it', desc: 'Every petal is shaped stitch by stitch.' },
  { num: '04', label: 'We wrap it', desc: 'Premium wrapping, ribbon, and gift-ready presentation.' },
  { num: '05', label: 'We ship it to you', desc: 'Pan-India delivery to your doorstep.' },
];

export const giftingOccasions = [
  'Birthday',
  'Anniversary',
  'Friendship',
  "Mother's Day",
  "Valentine's Day",
  'Just Because',
  'Festivals',
];

export const addOns = [
  { name: 'Greeting Card', price: 49, description: 'A handwritten card to accompany your gift.', image: '/greeting.avif' },
  { name: 'Personalised Message', price: 39, description: 'A custom message card tucked inside your wrapping.', image: '/message.avif' },
  { name: 'Name Customisation', price: 79, description: 'A name woven or attached to your bloom.' },
  { name: 'Premium Ribbon', price: 49, description: 'An upgraded ribbon finish on your bouquet wrapping.', image: '/ribbon.avif' },
  { name: 'Premium Wrapping', price: 79, description: 'Premium wrapping paper and packaging for your gift.', image: '/wrapping.avif' },
  { name: 'Extra Flower', price: 199, description: 'Add an additional bloom to any bouquet.', priceLabel: '₹199+' },
];

export const trustStrip = [
  { label: 'Handmade in India', icon: 'Heart' },
  { label: 'Made to order', icon: 'Clock' },
  { label: 'Custom colours', icon: 'Palette' },
  { label: 'Gift-ready', icon: 'Gift' },
  { label: 'Pan-India delivery', icon: 'Truck' },
];

export const footerPolicyLinks = [
  { label: 'Privacy Policy', path: '/privacy' },
  { label: 'Terms', path: '/terms' },
  { label: 'Refund / Cancellation', path: '/refund' },
];

export const bouquetTiers = [
  { name: 'Little Bloom', flowers: '1 flower', price: 199, code: 'TPB-BQ-001' },
  { name: 'Bloom Duo', flowers: '2 flowers', price: 249, code: 'TPB-BQ-002' },
  { name: 'Trio of Petals', flowers: '3 flowers', price: 399, code: 'TPB-BQ-003', popular: true },
  { name: 'Petal Story', flowers: '5 flowers', price: 449, code: 'TPB-BQ-004' },
  { name: 'Garden in Bloom', flowers: '7 flowers', price: 599, code: 'TPB-BQ-005' },
  { name: 'Forever Garden', flowers: '9 flowers', price: 699, code: 'TPB-BQ-006' },
];

export const instagramPosts: string[] = [];

// Hero and visual assets are loaded dynamically from Supabase site_assets table
export const heroImages = {
  primary: '',
  secondary: '',
  texture: '',
  hands: '',
  yarn: '',
  giftBox: '',
};

export const brandInfo = {
  name: 'The Petal & Bloom',
  tagline: 'Handmade Crochet Gifts & Blooms',
  secondaryMessage: 'Flowers that never fade. Gifts that stay.',
  instagram: '@thepetalandbloom',
  instagramUrl: 'https://instagram.com/thepetalandbloom',
  whatsappNumber: '+919861615937',
  email: '',
  businessHours: 'Monday – Saturday, 10 AM – 7 PM IST',
  responseTime: 'We typically respond within a few hours during business hours.',
  announcementsEnabled: true,
  announcements: [
    "Free shipping on orders above ₹1,200! 🌸",
    "Limited Edition Mother's Day collection now available. ✨",
    "Each petal is handmade with love and precision. 🧶",
    "Custom bouquets take 5-10 days to perfect. 🕰️"
  ]
};
