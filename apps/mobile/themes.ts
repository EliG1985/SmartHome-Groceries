// Theme definitions and unlock logic
import AsyncStorage from '@react-native-async-storage/async-storage';
export type Theme = {
  id: string;
  name: string;
  backgroundColor: string;
  gradient?: string;
  textColor: string;
  price: number; // in coins
};

export const THEMES: Theme[] = [
  {
    id: 'default',
    name: 'Classic Violet',
    backgroundColor: '#8b5cf6', // Purple color for default UI background
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #f4efff 100%)',
    textColor: '#ffffff', // White text for contrast
    price: 0,
  },
  {
    id: 'sunset',
    name: 'Sunset Glow',
    backgroundColor: '#ffecd2',
    gradient: 'linear-gradient(135deg, #fcb69f 0%, #ffecd2 100%)',
    textColor: '#6d4fe9',
    price: 200,
  },
  {
    id: 'mint',
    name: 'Mint Breeze',
    backgroundColor: '#d1f7e1',
    gradient: 'linear-gradient(135deg, #a8ff78 0%, #d1f7e1 100%)',
    textColor: '#0f172a',
    price: 200,
  },
  {
    id: 'night',
    name: 'Night Sky',
    backgroundColor: '#232946',
    gradient: 'linear-gradient(135deg, #232946 0%, #393e46 100%)',
    textColor: '#fff',
    price: 500,
  },
];

export const getUnlockedThemes = async (userId: string): Promise<string[]> => {
  const key = `mobile:themes:${userId}`;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return ['default'];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : ['default'];
  } catch {
    return ['default'];
  }
};

export const unlockTheme = async (userId: string, themeId: string): Promise<void> => {
  const unlocked = await getUnlockedThemes(userId);
  if (!unlocked.includes(themeId)) {
    const next = [...unlocked, themeId];
    const key = `mobile:themes:${userId}`;
    await AsyncStorage.setItem(key, JSON.stringify(next));
  }
};
