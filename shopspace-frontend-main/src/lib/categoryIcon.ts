// Maps a category name to a Tabler icon class. Falls back to a generic tag
// icon for any category not explicitly listed (e.g. future categories added
// later). Shared across MarketHome, ProductDetail, and MyListings so a given
// category always renders with the same icon everywhere.
export const categoryIcon = (name: string): string => {
  const key = name.toLowerCase();
  if (key.includes('textbook')) return 'ti-book';
  if (key.includes('electronic')) return 'ti-device-laptop';
  if (key.includes('hostel')) return 'ti-bed';
  if (key.includes('cloth')) return 'ti-shirt';
  if (key.includes('furniture')) return 'ti-armchair';
  return 'ti-tag';
};
