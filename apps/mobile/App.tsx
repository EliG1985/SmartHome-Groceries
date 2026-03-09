import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import { createClient, type Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { THEMES, getUnlockedThemes, unlockTheme, Theme } from './themes';
import {
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  Platform,
} from 'react-native';

type AppTab = 'account' | 'list' | 'inventory' | 'chat' | 'store' | 'reports' | 'participants' | 'settings';
type Locale = 'en' | 'he';

type InventoryItem = {
  id: string;
  product_name: string;
  category: string;
  status: 'In_List' | 'At_Home';
  quantity: number;
  price: number;
  expiry_date: string;
};

type AuthenticatedUser = {
  id: string;
  email: string;
  familyId: string;
  role: 'owner' | 'editor' | 'viewer';
  subscriptionTier: 'Free' | 'Premium';
};

type NearbyChain = {
  chain: string;
  nearestDistanceKm: number;
  nearestBranch: string;
};

type FamilyMember = {
  id: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
};

type HistoryField = 'email' | 'itemName' | 'category' | 'latitude' | 'longitude' | 'radiusKm';

const FIELD_HISTORY_KEYS: Record<HistoryField, string> = {
  email: 'mobile:history:email',
  itemName: 'mobile:history:itemName',
  category: 'mobile:history:category',
  latitude: 'mobile:history:latitude',
  longitude: 'mobile:history:longitude',
  radiusKm: 'mobile:history:radiusKm',
};

const DEFAULT_COORDS = { latitude: '31.9290318', longitude: '34.8682208' };
const WEB_API_BASE =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : null;
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || WEB_API_BASE || 'http://localhost:4000';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const PRIVACY_ACCEPT_KEY = 'mobile:privacy:accepted';
const LOCALE_KEY = 'mobile:locale';

const TEXT: Record<Locale, Record<string, string>> = {
  en: {
    loadingSession: 'Loading session...',
    appTitle: 'Smart Home Groceries',
    appSubtitle: 'A smart home starts with smart shopping',
    login: 'Login',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    continue: 'Continue',
    createAccount: 'Create account',
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: 'Already have an account?',
    firstName: 'First name',
    lastName: 'Last name',
    mobilePhone: 'Mobile phone',
    birthDate: 'Birth date',
    fillAllRequiredFields: 'Please fill all required fields.',
    invalidMobilePhone: 'Please enter a valid mobile phone number.',
    invalidBirthDate: 'Please enter a valid birth date.',
    english: 'English',
    hebrew: 'עברית',
    family: 'Family',
    shoppingListTitle: 'Shopping List (free for single user)',
    members: 'Members',
    monthlyPackage: 'Monthly package',
    active: 'Active',
    notPurchased: 'Not purchased',
    itemName: 'Item name',
    category: 'Category',
    addItem: 'Add item',
    bought: 'Bought',
    delete: 'Delete',
    atHome: 'At Home',
    noPantryItems: 'No pantry items yet.',
    familyChat: 'Family Chat',
    chatHint: 'Unlocked by monthly package. Integrate backend chat endpoints next.',
    reports: 'Reports',
    currentListItems: 'Current list items',
    atHomeItems: 'At home items',
    participants: 'Participants',
    storeTitle: 'In-App Purchase',
    coinsBalance: 'Coins balance',
    buy200: 'Buy 200 coins',
    buy500: 'Buy 500 coins',
    monthlyPackageTitle: 'Monthly Package (separate from coins)',
    monthlyPackageHint: 'Unlocks collaboration + shared updates + reports + chat.',
    purchased: 'Purchased',
    purchaseMonthly: 'Purchase monthly package',
    cancelSubscription: 'Cancel subscription',
    subscriptionCancelled: 'Subscription cancelled. Premium features are now disabled.',
    settings: 'Settings',
    nearbyLookup: 'Nearby supermarket lookup via backend',
    latitude: 'Latitude',
    longitude: 'Longitude',
    radiusKm: 'Radius km',
    findNearby: 'Find nearby supermarkets',
    account: 'Account',
    role: 'Role',
    familyId: 'Family ID',
    subscriptionTier: 'Subscription tier',
    purchasedPackages: 'Purchased packages',
    none: 'None',
    privacyCompliance: 'Privacy & Compliance',
    dataUsed: 'Data used: account profile, inventory data, optional location, optional notifications.',
    purpose: 'Purpose: shopping management, nearby supermarket lookup, reminders and collaboration alerts.',
    privacyAcceptance: 'Privacy acceptance',
    accepted: 'Accepted',
    notAccepted: 'Not accepted',
    revokeAcceptance: 'Revoke privacy acceptance',
    acceptTerms: 'Accept privacy terms',
    pushPermission: 'Push permission',
    enablePush: 'Enable push notifications',
    expoToken: 'Expo token',
    clearSavedInputs: 'Clear all saved inputs',
    savedInputsCleared: 'Saved input history cleared.',
    logout: 'Logout',
    tabs_list: 'List',
    tabs_account: 'Account',
    tabs_inventory: 'Inventory',
    tabs_chat: 'Chat',
    tabs_store: 'Store',
    tabs_reports: 'Reports',
    tabs_participants: 'Participants',
    tabs_settings: 'Settings',
  },
  he: {
    loadingSession: 'טוען סשן...',
    appTitle: 'קניות לבית חכם',
    appSubtitle: 'בית חכם מתחיל בקניה חכמה',
    login: 'התחברות',
    register: 'הרשמה',
    email: 'אימייל',
    password: 'סיסמה',
    continue: 'המשך',
    createAccount: 'יצירת חשבון',
    dontHaveAccount: 'אין לך חשבון עדיין?',
    alreadyHaveAccount: 'כבר יש לך חשבון?',
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    mobilePhone: 'מספר טלפון נייד',
    birthDate: 'תאריך לידה',
    fillAllRequiredFields: 'נא למלא את כל שדות החובה.',
    invalidMobilePhone: 'נא להזין מספר טלפון נייד תקין.',
    invalidBirthDate: 'נא להזין תאריך לידה תקין.',
    english: 'English',
    hebrew: 'עברית',
    family: 'משפחה',
    shoppingListTitle: 'רשימת קניות (חינם למשתמש יחיד)',
    members: 'משתתפים',
    monthlyPackage: 'חבילה חודשית',
    active: 'פעילה',
    notPurchased: 'לא נרכשה',
    itemName: 'שם מוצר',
    category: 'קטגוריה',
    addItem: 'הוספת פריט',
    bought: 'נקנה',
    delete: 'מחיקה',
    atHome: 'בבית',
    noPantryItems: 'אין עדיין מוצרים במזווה.',
    familyChat: 'צ׳אט משפחתי',
    chatHint: 'נפתח עם חבילה חודשית. השלב הבא: חיבור לנקודות הקצה של הצ׳אט בשרת.',
    reports: 'דוחות',
    currentListItems: 'פריטים ברשימה',
    atHomeItems: 'פריטים בבית',
    participants: 'משתתפים',
    storeTitle: 'רכישות בתוך האפליקציה',
    coinsBalance: 'יתרת מטבעות',
    buy200: 'רכישת 200 מטבעות',
    buy500: 'רכישת 500 מטבעות',
    monthlyPackageTitle: 'חבילה חודשית (נפרדת ממטבעות)',
    monthlyPackageHint: 'פותחת שיתופיות + עדכונים משותפים + דוחות + צ׳אט.',
    purchased: 'נרכשה',
    purchaseMonthly: 'רכישת חבילה חודשית',
    cancelSubscription: 'ביטול מנוי',
    subscriptionCancelled: 'המינוי בוטל. תכונות הפרימיום כבויות כעת.',
    settings: 'הגדרות',
    nearbyLookup: 'חיפוש סופרים קרובים דרך השרת',
    latitude: 'קו רוחב',
    longitude: 'קו אורך',
    radiusKm: 'רדיוס בק״מ',
    findNearby: 'חיפוש סופרים קרובים',
    account: 'חשבון',
    role: 'תפקיד',
    familyId: 'מזהה משפחה',
    subscriptionTier: 'רמת מנוי',
    purchasedPackages: 'חבילות שנרכשו',
    none: 'ללא',
    privacyCompliance: 'פרטיות ותאימות',
    dataUsed: 'נתונים בשימוש: פרופיל חשבון, נתוני מלאי, מיקום אופציונלי, התראות אופציונליות.',
    purpose: 'מטרה: ניהול קניות, חיפוש סופרים קרובים, תזכורות והתראות שיתופיות.',
    privacyAcceptance: 'אישור פרטיות',
    accepted: 'אושר',
    notAccepted: 'לא אושר',
    revokeAcceptance: 'ביטול אישור פרטיות',
    acceptTerms: 'אישור תנאי פרטיות',
    pushPermission: 'הרשאת התראות',
    enablePush: 'הפעלת התראות פוש',
    expoToken: 'אסימון Expo',
    clearSavedInputs: 'מחיקת כל הקלטים השמורים',
    savedInputsCleared: 'היסטוריית הקלטים השמורים נמחקה.',
    logout: 'התנתקות',
    tabs_list: 'רשימה',
    tabs_account: 'חשבון',
    tabs_inventory: 'מלאי',
    tabs_chat: 'צ׳אט',
    tabs_store: 'חנות',
    tabs_reports: 'דוחות',
    tabs_participants: 'משתתפים',
    tabs_settings: 'הגדרות',
  },
};

if (Platform.OS === 'web' && typeof __DEV__ !== 'undefined' && __DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const message = String(args[0] ?? '');
    if (message.includes('Cannot record touch end without a touch start.')) {
      return;
    }
    originalConsoleError(...args);
  };
}

type NotificationsModule = typeof import('expo-notifications');

const getNotificationsModule = (): NotificationsModule | null => {
  if (Platform.OS === 'web') return null;
  return require('expo-notifications') as NotificationsModule;
};

const notificationsModule = getNotificationsModule();

if (notificationsModule) {
  notificationsModule.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage as unknown as Storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

function createId() {
  return Math.random().toString(36).slice(2, 11);
}

export default function App() {
    // Real-time geolocation tracker
    const [location, setLocation] = useState<{ latitude: string, longitude: string } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    // Theme unlock and selection
    const [selectedThemeId, setSelectedThemeId] = useState('default');
    const [unlockedThemes, setUnlockedThemes] = useState<string[]>(['default']);
    const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
    const selectedTheme: Theme = THEMES.find(t => t.id === selectedThemeId) || THEMES[0];
    const { width: windowWidth } = useWindowDimensions();
    const drawerWidth = Math.min(340, Math.max(240, Math.floor(windowWidth * 0.78)));
    const [locale, setLocale] = useState<Locale>('en');
    const [activeTab, setActiveTab] = useState<AppTab>('list');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showLanguageOptions, setShowLanguageOptions] = useState(false);
    const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const [statusText, setStatusText] = useState<string>('');
    useEffect(() => {
      // Load unlocked themes for user
      if (currentUser) {
        getUnlockedThemes(currentUser.id).then((themes) => setUnlockedThemes(themes));
      }
    }, [currentUser]);
    useEffect(() => {
      let watcher: Location.LocationSubscription | null = null;
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Permission to access location was denied');
          return;
        }
        watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
          (pos) => {
            setLocation({
              latitude: String(pos.coords.latitude),
              longitude: String(pos.coords.longitude),
            });
            setLatitude(String(pos.coords.latitude));
            setLongitude(String(pos.coords.longitude));
          }
        );
      })();
      return () => { if (watcher) watcher.remove(); };
    }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeEmailInput, setActiveEmailInput] = useState<'login' | 'register'>('login');
  const [registerFirstName, setRegisterFirstName] = useState('');
  const [registerLastName, setRegisterLastName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerBirthDate, setRegisterBirthDate] = useState('');
  const [registerBirthDateValue, setRegisterBirthDateValue] = useState<Date | null>(null);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('General');

  const [coinsBalance, setCoinsBalance] = useState(0);
  const [hasMonthlyPackage, setHasMonthlyPackage] = useState(false);
  const [purchasedPackages, setPurchasedPackages] = useState<string[]>([]);
  const [memberCount, setMemberCount] = useState(1);
  const [participants, setParticipants] = useState<FamilyMember[]>([]);
  const [pushPermission, setPushPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [latitude, setLatitude] = useState(DEFAULT_COORDS.latitude);
  const [longitude, setLongitude] = useState(DEFAULT_COORDS.longitude);
  const [radiusKm, setRadiusKm] = useState('1');
  const [nearbyChains, setNearbyChains] = useState<NearbyChain[]>([]);
  const [fieldHistory, setFieldHistory] = useState<Record<HistoryField, string[]>>({
    email: [],
    itemName: [],
    category: [],
    latitude: [],
    longitude: [],
    radiusKm: [],
  });
  const [activeHistoryField, setActiveHistoryField] = useState<HistoryField | null>(null);
  const blurCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectingSuggestionRef = useRef(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerTranslateX = useRef(new Animated.Value(drawerWidth)).current;

  const t = TEXT[locale];
  const isRtl = locale === 'he';

  const listItems = useMemo(() => items.filter((item) => item.status === 'In_List'), [items]);
  const homeItems = useMemo(() => items.filter((item) => item.status === 'At_Home'), [items]);

  const premiumFeaturesLocked = !hasMonthlyPackage;
  const sharedListLocked = premiumFeaturesLocked && memberCount > 1;
  const isRegisterFormComplete = Boolean(
    registerFirstName.trim() &&
    registerLastName.trim() &&
    registerEmail.trim() &&
    registerPassword.trim() &&
    registerPhone.trim() &&
    registerBirthDate.trim(),
  );

  const monthlyPackageKey = currentUser ? `mobile:monthly:${currentUser.id}` : '';
  const coinsKey = currentUser ? `mobile:coins:${currentUser.id}` : '';

  const authHeaders = (): Record<string, string> => {
    const token = session?.access_token;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  };

  const requestApi = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(typeof init?.headers === 'object' && init.headers ? (init.headers as Record<string, string>) : {}),
    };

    const response = await fetch(`${API_BASE}${path}`, {
      headers,
      ...init,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `API error: ${response.status}`);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  };

  const loadInventory = async () => {
    if (!session) return;
    try {
      const data = await requestApi<InventoryItem[]>('/api/inventory');
      setItems(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load inventory.';
      setStatusText(message);
    }
  };

  const loadProfileAndSubscription = async () => {
    if (!session) return;

    try {
      const profile = await requestApi<{
        id: string;
        email: string;
        familyId: string;
        role: 'owner' | 'editor' | 'viewer';
        subscriptionTier: 'Free' | 'Premium';
      }>('/api/collaboration/me');

      setCurrentUser(profile);

      const subscription = await requestApi<{ memberCount: number }>('/api/collaboration/subscription-status');
      setMemberCount(subscription.memberCount || 1);

      const participantPayload = await requestApi<{ members: FamilyMember[] }>('/api/collaboration/participants');
      setParticipants(participantPayload.members || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load profile.';
      setStatusText(message);
    }
  };

  const loadPurchaseState = async () => {
    if (!currentUser) return;

    try {
      const [monthlyRaw, coinsRaw] = await Promise.all([
        AsyncStorage.getItem(`mobile:monthly:${currentUser.id}`),
        AsyncStorage.getItem(`mobile:coins:${currentUser.id}`),
      ]);

      const coins = coinsRaw ? Number(coinsRaw) : 0;
      setCoinsBalance(Number.isFinite(coins) && coins >= 0 ? coins : 0);

      if (!monthlyRaw) {
        setHasMonthlyPackage(currentUser.subscriptionTier === 'Premium');
        setPurchasedPackages(currentUser.subscriptionTier === 'Premium' ? ['Premium'] : []);
        return;
      }

      const parsed = JSON.parse(monthlyRaw) as { active?: boolean; planName?: string };
      const active = Boolean(parsed.active) || currentUser.subscriptionTier === 'Premium';
      setHasMonthlyPackage(active);
      setPurchasedPackages(active ? [parsed.planName || 'Family Monthly Package'] : []);
    } catch {
      setHasMonthlyPackage(currentUser.subscriptionTier === 'Premium');
      setPurchasedPackages(currentUser.subscriptionTier === 'Premium' ? ['Premium'] : []);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setStatusText('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY for mobile auth.');
      setAuthReady(true);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (blurCloseTimerRef.current) {
        clearTimeout(blurCloseTimerRef.current);
        blurCloseTimerRef.current = null;
      }
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
        statusTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setCurrentUser(null);
      setItems([]);
      return;
    }

    void loadProfileAndSubscription();
    void loadInventory();
  }, [session]);

  useEffect(() => {
    if (!currentUser) return;
    void loadPurchaseState();
  }, [currentUser]);

  useEffect(() => {
    void AsyncStorage.getItem(PRIVACY_ACCEPT_KEY).then((value) => {
      setPrivacyAccepted(value === 'true');
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(LOCALE_KEY).then((value) => {
      if (value === 'en' || value === 'he') {
        setLocale(value);
      }
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const loadedEntries = await Promise.all(
        (Object.keys(FIELD_HISTORY_KEYS) as HistoryField[]).map(async (field) => {
          const raw = await AsyncStorage.getItem(FIELD_HISTORY_KEYS[field]);
          if (!raw) return [field, []] as const;
          try {
            const parsed = JSON.parse(raw) as string[];
            return [field, Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []] as const;
          } catch {
            return [field, []] as const;
          }
        }),
      );

      setFieldHistory((prev) => {
        const next = { ...prev };
        loadedEntries.forEach(([field, values]) => {
          next[field] = [...values];
        });
        return next;
      });
    })();
  }, []);

  const persistFieldHistory = (field: HistoryField, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setFieldHistory((prev) => {
      const previous = prev[field] || [];
      const deduped = [trimmed, ...previous.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      void AsyncStorage.setItem(FIELD_HISTORY_KEYS[field], JSON.stringify(deduped));
      return { ...prev, [field]: deduped };
    });
  };

  const clearBlurCloseTimer = () => {
    if (!blurCloseTimerRef.current) return;
    clearTimeout(blurCloseTimerRef.current);
    blurCloseTimerRef.current = null;
  };

  const onHistoryFieldFocus = (field: HistoryField) => {
    selectingSuggestionRef.current = false;
    clearBlurCloseTimer();
    setActiveHistoryField(field);
  };

  const onHistoryFieldBlur = (field: HistoryField, value: string) => {
    if (selectingSuggestionRef.current) {
      clearBlurCloseTimer();
      return;
    }

    persistFieldHistory(field, value);
    clearBlurCloseTimer();
    blurCloseTimerRef.current = setTimeout(() => {
      setActiveHistoryField(null);
      blurCloseTimerRef.current = null;
    }, 160);
  };

  const showStatusText = (message: string, autoClearMs?: number) => {
    setStatusText(message);
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    if (autoClearMs && autoClearMs > 0) {
      statusTimerRef.current = setTimeout(() => {
        setStatusText('');
        statusTimerRef.current = null;
      }, autoClearMs);
    }
  };

  const suggestionsFor = (field: HistoryField, value: string): string[] => {
    const typed = value.trim().toLowerCase();
    if (!typed) return [];
    return (fieldHistory[field] || []).filter((entry) => entry.toLowerCase().includes(typed)).slice(0, 5);
  };

  const onSelectSuggestion = (field: HistoryField, value: string) => {
    selectingSuggestionRef.current = true;
    clearBlurCloseTimer();
    if (field === 'email') {
      if (activeEmailInput === 'register') {
        setRegisterEmail(value);
      } else {
        setEmail(value);
      }
    }
    if (field === 'itemName') setNewItemName(value);
    if (field === 'category') setNewItemCategory(value);
    if (field === 'latitude') setLatitude(value);
    if (field === 'longitude') setLongitude(value);
    if (field === 'radiusKm') setRadiusKm(value);
    persistFieldHistory(field, value);
    selectingSuggestionRef.current = false;
    setActiveHistoryField(null);
  };

  const clearAllSavedInputs = async () => {
    const keys = Object.values(FIELD_HISTORY_KEYS);
    await AsyncStorage.multiRemove(keys);
    setFieldHistory({
      email: [],
      itemName: [],
      category: [],
      latitude: [],
      longitude: [],
      radiusKm: [],
    });
    setActiveHistoryField(null);
    setStatusText(t.savedInputsCleared);
  };

  const renderSuggestions = (field: HistoryField, value: string) => {
    if (activeHistoryField !== field) return null;
    const suggestions = suggestionsFor(field, value);
    if (!suggestions.length) return null;

    return (
      <View style={styles.suggestionBox}>
        {suggestions.map((entry) => (
          <Pressable
            key={`${field}-${entry}`}
            style={styles.suggestionItem}
            onPressIn={() => {
              selectingSuggestionRef.current = true;
              clearBlurCloseTimer();
            }}
            onPress={() => onSelectSuggestion(field, entry)}
          >
            <Text style={styles.suggestionText}>{entry}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const changeLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    void AsyncStorage.setItem(LOCALE_KEY, nextLocale);
  };

  const tabLabel = (tab: AppTab): string => {
    const key = `tabs_${tab}`;
    return t[key] || tab;
  };

  const localeLabel = (value: Locale): string => {
    return value === 'he' ? t.hebrew : t.english;
  };

  useEffect(() => {
    const target = isMenuOpen ? 0 : drawerWidth;
    drawerTranslateX.setValue(target);
  }, [drawerTranslateX, drawerWidth, isMenuOpen]);

  const menuHandleTranslateX = drawerTranslateX.interpolate({
    inputRange: [0, drawerWidth],
    outputRange: [-drawerWidth, 0],
    extrapolate: 'clamp',
  });

  const openMenu = () => {
    setIsMenuOpen(true);
    Animated.timing(drawerTranslateX, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(drawerTranslateX, {
      toValue: drawerWidth,
      duration: 220,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setIsMenuOpen(false);
    });
  };

  const onSelectMenuTab = (tab: AppTab) => {
    if (!requireUnlockedFeature(tab)) {
      closeMenu();
      return;
    }
    setActiveTab(tab);
    closeMenu();
  };

  const togglePrivacyAcceptance = async () => {
    const next = !privacyAccepted;
    setPrivacyAccepted(next);
    await AsyncStorage.setItem(PRIVACY_ACCEPT_KEY, String(next));
  };

  const enablePushNotifications = async () => {
    const notifications = getNotificationsModule();
    if (!notifications) {
      setPushPermission('denied');
      setStatusText('Push notifications are not supported on web.');
      return;
    }

    if (!Device.isDevice) {
      setStatusText('Push notifications require a physical device.');
      return;
    }

    const existing = await notifications.getPermissionsAsync();
    let finalStatus = existing.status;

    if (existing.status !== 'granted') {
      const requested = await notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
      setPushPermission('denied');
      setStatusText('Push notification permission denied.');
      return;
    }

    if (Platform.OS === 'android') {
      await notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: notifications.AndroidImportance.DEFAULT,
      });
    }

    setPushPermission('granted');
    try {
      const token = await notifications.getExpoPushTokenAsync();
      setExpoPushToken(token.data);
      setStatusText('Push notifications enabled.');
    } catch {
      setStatusText('Push permission granted, token fetch failed (set EAS project config for production).');
    }
  };

  const requireUnlockedFeature = (tab: AppTab) => {
    if (['inventory', 'chat', 'reports', 'participants'].includes(tab) && premiumFeaturesLocked) {
      setStatusText('This feature is locked. Purchase Monthly Package in Store to unlock it.');
      setActiveTab('store');
      return false;
    }
    return true;
  };

  const onLogin = async () => {
    if (!supabase) {
      showStatusText('Supabase auth is not configured in mobile env.');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      showStatusText(error.message, 5000);
      return;
    }

    persistFieldHistory('email', email);
    setStatusText('');
    // Always navigate to shopping list after login
    setActiveTab('list');
    // Optionally clear login fields
    setEmail('');
    setPassword('');
    // Session state will be updated by supabase.auth.onAuthStateChange
    // Profile/inventory reload handled by useEffect([session])
  };

  const onRegister = async () => {
    if (!supabase) {
      showStatusText('Supabase auth is not configured in mobile env.');
      return;
    }

    if (!isRegisterFormComplete) {
      showStatusText(t.fillAllRequiredFields, 5000);
      return;
    }

    if (!/^\+?[0-9\-\s]{9,15}$/.test(registerPhone.trim())) {
      showStatusText(t.invalidMobilePhone, 5000);
      return;
    }

    const birthDateMs = Date.parse(registerBirthDate);
    if (Number.isNaN(birthDateMs) || birthDateMs > Date.now()) {
      showStatusText(t.invalidBirthDate, 5000);
      return;
    }

    const fullName = `${registerFirstName.trim()} ${registerLastName.trim()}`.trim();
    const fallbackFamilyName = `${registerLastName.trim()} Family`;

    const signupWithMetadata = await supabase.auth.signUp({
      email: registerEmail.trim(),
      password: registerPassword,
      options: {
        data: {
          first_name: registerFirstName.trim(),
          last_name: registerLastName.trim(),
          full_name: fullName,
          family_name: fallbackFamilyName,
          mobile_phone: registerPhone.trim(),
          birth_date: registerBirthDate,
        },
      },
    });

    let signupError = signupWithMetadata.error;
    if (signupError) {
      const signupFallback = await supabase.auth.signUp({
        email: registerEmail.trim(),
        password: registerPassword,
      });
      signupError = signupFallback.error;
    }

    if (signupError) {
      const friendlyMessage = signupError.message.includes('Database error saving new user')
        ? 'Registration failed on server profile creation. Please verify Supabase DB trigger/configuration and try again.'
        : signupError.message;
      showStatusText(friendlyMessage, 6000);
      return;
    }

    const profileStorageKey = `mobile:user-profile:${registerEmail.trim().toLowerCase()}`;
    await AsyncStorage.setItem(
      profileStorageKey,
      JSON.stringify({
        firstName: registerFirstName.trim(),
        lastName: registerLastName.trim(),
        email: registerEmail.trim(),
        mobilePhone: registerPhone.trim(),
        birthDate: registerBirthDate,
      }),
    );

    persistFieldHistory('email', registerEmail);

    setAuthMode('login');
    setEmail(registerEmail.trim());
    setPassword(registerPassword);
    showStatusText('Account created. Check email verification if enabled, then log in.', 5000);

    setRegisterFirstName('');
    setRegisterLastName('');
    setRegisterEmail('');
    setRegisterPassword('');
    setRegisterPhone('');
    setRegisterBirthDate('');
    setRegisterBirthDateValue(null);
    setShowBirthDatePicker(false);
  };

  const onSelectBirthDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowBirthDatePicker(false);
    if (event.type !== 'set' || !selectedDate) return;
    setRegisterBirthDateValue(selectedDate);
    const normalizedDate = new Date(selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    setRegisterBirthDate(normalizedDate);
  };

  const addListItem = () => {
    if (!currentUser) return;
    if (sharedListLocked) {
      Alert.alert('Locked', 'Shared shopping list updates require monthly package.');
      return;
    }
    if (!newItemName.trim()) return;

    persistFieldHistory('itemName', newItemName);
    persistFieldHistory('category', newItemCategory);

    const nextItem: InventoryItem = {
      id: `item-${createId()}`,
      product_name: newItemName.trim(),
      category: newItemCategory.trim() || 'General',
      status: 'In_List',
      quantity: 1,
      price: 10,
      expiry_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    };

    void requestApi<InventoryItem>('/api/inventory', {
      method: 'POST',
      body: JSON.stringify({
        ...nextItem,
        family_id: currentUser.familyId,
      }),
    })
      .then((created) => {
        setItems((prev) => [created, ...prev]);
        setNewItemName('');
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Could not add item.';
        setStatusText(message);
      });
  };

  const moveToHome = (id: string) => {
    if (!currentUser) return;
    if (sharedListLocked) {
      Alert.alert('Locked', 'Shared shopping list updates require monthly package.');
      return;
    }

    void requestApi<void>(`/api/inventory/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'At_Home' }),
    })
      .then(() => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'At_Home' } : item)));
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Could not update item.';
        setStatusText(message);
      });
  };

  const removeItem = (id: string) => {
    if (!currentUser) return;
    if (sharedListLocked) {
      Alert.alert('Locked', 'Shared shopping list updates require monthly package.');
      return;
    }

    void requestApi<void>(`/api/inventory/${id}`, { method: 'DELETE' })
      .then(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Could not delete item.';
        setStatusText(message);
      });
  };

  const buyCoinPack = (coins: number) => {
    if (!currentUser) return;
    const next = coinsBalance + coins;
    setCoinsBalance(next);
    if (coinsKey) {
      void AsyncStorage.setItem(coinsKey, String(next));
    }
    // Reload unlocked themes after coin purchase
    if (currentUser) getUnlockedThemes(currentUser.id).then(setUnlockedThemes);
  };

  const buyMonthlyPackage = () => {
    if (!currentUser) return;
    setHasMonthlyPackage(true);
    setPurchasedPackages(['Family Monthly Package']);
    if (monthlyPackageKey) {
      void AsyncStorage.setItem(
        monthlyPackageKey,
        JSON.stringify({
          active: true,
          planName: 'Family Monthly Package',
          purchasedAt: new Date().toISOString(),
        }),
      );
    }
    setStatusText('Monthly package purchased. Premium features unlocked.');
  };

  const cancelMonthlyPackage = async () => {
    if (!currentUser) return;

    try {
      await requestApi<{ cancelled: unknown; status: { memberCount: number } }>('/api/collaboration/subscription/cancel', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch {
      // keep local cancellation path available even when backend route is unavailable
    }

    setHasMonthlyPackage(false);
    setPurchasedPackages([]);
    setCurrentUser((prev) => (prev ? { ...prev, subscriptionTier: 'Free' } : prev));

    if (monthlyPackageKey) {
      await AsyncStorage.setItem(
        monthlyPackageKey,
        JSON.stringify({
          active: false,
          planName: 'Family Monthly Package',
          cancelledAt: new Date().toISOString(),
        }),
      );
    }

    setStatusText(t.subscriptionCancelled);
  };

  const loadNearby = async () => {
    const lat = location && typeof location.latitude === 'string' ? Number(location.latitude) : Number(latitude);
    const lon = location && typeof location.longitude === 'string' ? Number(location.longitude) : Number(longitude);
    const radius = Number(radiusKm);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radius) || radius < 0 || radius > 10000) {
      setStatusText('Enter valid latitude, longitude and radius (0-10,000 km).');
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE}/api/reports/nearby-supermarkets?latitude=${lat}&longitude=${lon}&radiusKm=${radius}`,
      );
      const json = (await response.json()) as { chains?: NearbyChain[] };
      setNearbyChains(json.chains || []);
      if (!json.chains?.length) setStatusText('No nearby supermarkets found for this radius.');
    } catch {
      setStatusText('Failed to load nearby supermarkets. Check backend URL/network.');
    }
  };

  if (!authReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.authCard}>
          <Text style={styles.title}>{t.loadingSession}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.authCard}>
          <View style={styles.authGlowTop} />
          <View style={styles.authGlowBottom} />

          <View style={styles.authLanguageCorner}>
            <View style={styles.comboWrap}>
              <Pressable
                style={[styles.comboBtn, styles.authComboBtn]}
                onPress={() => setShowLanguageOptions((prev) => !prev)}
              >
                <Text style={styles.modeText}>{localeLabel(locale)} ▾</Text>
              </Pressable>
              {showLanguageOptions ? (
                <View style={[styles.comboMenu, styles.authComboMenu]}>
                  <Pressable
                    style={styles.comboOption}
                    onPress={() => {
                      changeLocale('en');
                      setShowLanguageOptions(false);
                    }}
                  >
                    <Text style={styles.modeText}>{t.english}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.comboOption}
                    onPress={() => {
                      changeLocale('he');
                      setShowLanguageOptions(false);
                    }}
                  >
                    <Text style={styles.modeText}>{t.hebrew}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.authHero}>
            <View style={styles.authIconWrap}>
              <Text style={styles.authIcon}>🛒</Text>
            </View>
            <Text style={[styles.title, styles.authTitle]}>{t.appTitle}</Text>
            <Text style={[styles.subtitle, styles.authSubtitle]}>{t.appSubtitle}</Text>
          </View>

          {authMode === 'login' ? (
            <>
              <TextInput
                placeholder={t.email}
                style={[styles.input, isRtl ? styles.inputRtl : styles.inputLtr]}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                onFocus={() => {
                  setActiveEmailInput('login');
                  onHistoryFieldFocus('email');
                }}
                onBlur={() => onHistoryFieldBlur('email', email)}
              />
              {renderSuggestions('email', email)}
              <TextInput placeholder={t.password} style={[styles.input, isRtl ? styles.inputRtl : styles.inputLtr]} value={password} onChangeText={setPassword} secureTextEntry />

              <View style={styles.authActionsWrap}>
                <Pressable style={[styles.primaryBtn, styles.authLoginBtn]} onPress={onLogin}>
                  <Text style={styles.primaryBtnText}>{t.login}</Text>
                </Pressable>

                <Text style={styles.authHint}>{t.dontHaveAccount}</Text>
                <Pressable
                  style={[styles.secondaryBtn, styles.authRegisterBtn]}
                  onPress={() => {
                    setAuthMode('register');
                    showStatusText('');
                  }}
                >
                  <Text style={styles.secondaryBtnText}>{t.register}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <TextInput
                placeholder={t.firstName}
                style={[styles.input, isRtl ? styles.inputRtl : styles.inputLtr]}
                value={registerFirstName}
                onChangeText={setRegisterFirstName}
              />
              <TextInput
                placeholder={t.lastName}
                style={[styles.input, isRtl ? styles.inputRtl : styles.inputLtr]}
                value={registerLastName}
                onChangeText={setRegisterLastName}
              />
              <TextInput
                placeholder={t.email}
                style={[styles.input, isRtl ? styles.inputRtl : styles.inputLtr]}
                value={registerEmail}
                onChangeText={setRegisterEmail}
                autoCapitalize="none"
                onFocus={() => {
                  setActiveEmailInput('register');
                  onHistoryFieldFocus('email');
                }}
                onBlur={() => onHistoryFieldBlur('email', registerEmail)}
              />
              {renderSuggestions('email', registerEmail)}
              <TextInput
                placeholder={t.password}
                style={[styles.input, isRtl ? styles.inputRtl : styles.inputLtr]}
                value={registerPassword}
                onChangeText={setRegisterPassword}
                secureTextEntry
              />
              <TextInput
                placeholder={t.mobilePhone}
                style={[styles.input, isRtl ? styles.inputRtl : styles.inputLtr]}
                value={registerPhone}
                onChangeText={setRegisterPhone}
                keyboardType="phone-pad"
              />
              {Platform.OS === 'web' ? (
                createElement('input', {
                  type: 'date',
                  value: registerBirthDate,
                  onChange: (event: { target: { value: string } }) => setRegisterBirthDate(event.target.value),
                  style: {
                    boxSizing: 'border-box',
                    display: 'block',
                    width: '100%',
                    height: 44,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: '#d7c9fb',
                    borderRadius: 12,
                    backgroundColor: '#fff',
                    padding: 10,
                    marginBottom: 8,
                    fontSize: 14,
                    textAlign: isRtl ? 'right' : 'left',
                  },
                  'aria-label': t.birthDate,
                })
              ) : (
                <>
                  <Pressable
                    style={[styles.input, styles.datePickerTrigger]}
                    onPress={() => setShowBirthDatePicker(true)}
                  >
                    <Text
                      style={[
                        registerBirthDate ? styles.datePickerValueText : styles.datePickerPlaceholderText,
                        isRtl ? styles.datePickerTextRtl : styles.datePickerTextLtr,
                      ]}
                    >
                      {registerBirthDate || t.birthDate}
                    </Text>
                  </Pressable>
                  {showBirthDatePicker ? (
                    <DateTimePicker
                      value={registerBirthDateValue ?? new Date(2000, 0, 1)}
                      mode="date"
                      display="default"
                      maximumDate={new Date()}
                      onChange={onSelectBirthDate}
                    />
                  ) : null}
                </>
              )}

              <View style={styles.authActionsWrap}>
                <Pressable
                  style={[styles.primaryBtn, styles.authLoginBtn, !isRegisterFormComplete && styles.authPrimaryDisabled]}
                  onPress={onRegister}
                  disabled={!isRegisterFormComplete}
                >
                  <Text style={styles.primaryBtnText}>{t.createAccount}</Text>
                </Pressable>
              </View>
            </>
          )}

          {!!statusText && <Text style={styles.infoText}>{statusText}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: selectedTheme.backgroundColor }]}> 
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={{ justifyContent: 'center', alignItems: 'center', position: 'relative', backgroundColor: selectedTheme.backgroundColor }}>
          <Text style={[styles.title, { color: selectedTheme.textColor }]}>{t.appTitle}</Text>
          <Pressable
            style={[styles.menuButton, { position: 'absolute', right: 0, top: 0 }]}
            onPress={() => (isMenuOpen ? closeMenu() : openMenu())}
          >
            <Text style={styles.menuEdgeButtonText}>≡</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {activeTab === 'list' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t.shoppingListTitle}</Text>
            <Text style={styles.smallText}>{t.members}: {memberCount} · {t.monthlyPackage}: {hasMonthlyPackage ? t.active : t.notPurchased}</Text>

            <TextInput
              placeholder={t.itemName}
              style={[styles.input, isRtl ? styles.inputRtl : styles.inputLtr]}
              value={newItemName}
              onChangeText={setNewItemName}
              onFocus={() => onHistoryFieldFocus('itemName')}
              onBlur={() => onHistoryFieldBlur('itemName', newItemName)}
            />
            {renderSuggestions('itemName', newItemName)}
            <TextInput
              placeholder={t.category}
              style={[styles.input, isRtl ? styles.inputRtl : styles.inputLtr]}
              value={newItemCategory}
              onChangeText={setNewItemCategory}
              onFocus={() => onHistoryFieldFocus('category')}
              onBlur={() => onHistoryFieldBlur('category', newItemCategory)}
            />
            {renderSuggestions('category', newItemCategory)}
            <Pressable style={styles.primaryBtn} onPress={addListItem}>
              <Text style={styles.primaryBtnText}>{t.addItem}</Text>
            </Pressable>

            {listItems.map((item) => (
              <View key={item.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{item.product_name}</Text>
                  <Text style={styles.smallText}>{item.category}</Text>
                </View>
                <Pressable style={styles.actionBtn} onPress={() => moveToHome(item.id)}>
                  <Text style={styles.actionBtnText}>{t.bought}</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.dangerBtn]} onPress={() => removeItem(item.id)}>
                  <Text style={styles.actionBtnText}>{t.delete}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'inventory' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t.atHome}</Text>
            {homeItems.map((item) => (
              <View key={item.id} style={styles.listRow}>
                <Text style={styles.listTitle}>{item.product_name}</Text>
                <Text style={styles.smallText}>{item.expiry_date}</Text>
              </View>
            ))}
            {!homeItems.length && <Text style={styles.smallText}>{t.noPantryItems}</Text>}
          </View>
        )}

        {activeTab === 'chat' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t.familyChat}</Text>
              <Text style={styles.smallText}>{t.chatHint}</Text>
          </View>
        )}

        {activeTab === 'reports' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t.reports}</Text>
            <Text style={styles.smallText}>{t.currentListItems}: {listItems.length}</Text>
            <Text style={styles.smallText}>{t.atHomeItems}: {homeItems.length}</Text>
          </View>
        )}

        {activeTab === 'participants' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t.participants}</Text>
            {participants.map((member) => (
                <Text key={member.id} style={styles.smallText}>
                  {member.email} · {member.role}
                </Text>
              ))}
          </View>
        )}

        {activeTab === 'store' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t.storeTitle}</Text>
            <Text style={styles.smallText}>{t.coinsBalance}: {coinsBalance}</Text>
            <View style={styles.row}>
              <Pressable style={styles.secondaryBtn} onPress={() => buyCoinPack(200)}>
                <Text style={styles.secondaryBtnText}>{t.buy200}</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => buyCoinPack(500)}>
                <Text style={styles.secondaryBtnText}>{t.buy500}</Text>
              </Pressable>
            </View>
            <View style={[styles.card, { marginTop: 12 }]}> 
              <Text style={styles.sectionTitle}>{t.monthlyPackageTitle}</Text>
              <Text style={styles.smallText}>{t.monthlyPackageHint}</Text>
              <Pressable style={styles.primaryBtn} onPress={buyMonthlyPackage}>
                <Text style={styles.primaryBtnText}>{hasMonthlyPackage ? t.purchased : t.purchaseMonthly}</Text>
              </Pressable>
              {hasMonthlyPackage ? (
                <Pressable style={styles.secondaryBtn} onPress={() => void cancelMonthlyPackage()}>
                  <Text style={styles.secondaryBtnText}>{t.cancelSubscription}</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={[styles.card, { marginTop: 12 }]}> 
              <Text style={styles.sectionTitle}>App Themes & Backgrounds</Text>
              <Pressable style={styles.primaryBtn} onPress={() => setThemeSelectorOpen((open) => !open)}>
                <Text style={styles.primaryBtnText}>Select Theme</Text>
              </Pressable>
              {themeSelectorOpen && (
                <View style={{ marginTop: 12 }}>
                  {THEMES.map((theme) => {
                    const unlocked = unlockedThemes.includes(theme.id);
                    return (
                      <View key={theme.id} style={{ marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: theme.backgroundColor }}>
                        <Text style={{ color: theme.textColor, fontWeight: 'bold' }}>{theme.name}</Text>
                        <Text style={{ color: theme.textColor }}>Price: {theme.price} coins</Text>
                        {unlocked ? (
                          <Pressable style={styles.secondaryBtn} onPress={() => setSelectedThemeId(theme.id)}>
                            <Text style={styles.secondaryBtnText}>Apply</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={styles.secondaryBtn}
                            onPress={async () => {
                              if (coinsBalance >= theme.price && currentUser) {
                                setCoinsBalance(coinsBalance - theme.price);
                                await unlockTheme(currentUser.id, theme.id);
                                getUnlockedThemes(currentUser.id).then(setUnlockedThemes);
                                setSelectedThemeId(theme.id);
                                showStatusText('Theme unlocked!', 3000);
                              } else {
                                showStatusText('Not enough coins to unlock this theme.', 3000);
                              }
                            }}
                          >
                            <Text style={styles.secondaryBtnText}>Unlock</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        {activeTab === 'settings' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t.settings}</Text>

            <View style={styles.row}>
              <Pressable style={[styles.modeBtn, locale === 'en' && styles.modeBtnActive]} onPress={() => changeLocale('en')}>
                <Text style={styles.modeText}>{t.english}</Text>
              </Pressable>
              <Pressable style={[styles.modeBtn, locale === 'he' && styles.modeBtnActive]} onPress={() => changeLocale('he')}>
                <Text style={styles.modeText}>{t.hebrew}</Text>
              </Pressable>
            </View>

            <Text style={styles.smallText}>{t.nearbyLookup}</Text>

            <View style={{ marginBottom: 8 }}>
              <Text style={styles.smallText}>Current Location:</Text>
              {locationError ? (
                <Text style={[styles.smallText, { color: 'red' }]}>{locationError}</Text>
              ) : location ? (
                <Text style={styles.smallText}>
                  Latitude: {location.latitude}, Longitude: {location.longitude}
                </Text>
              ) : (
                <Text style={styles.smallText}>Locating...</Text>
              )}
            </View>
            <TextInput
              placeholder={t.radiusKm}
              style={[styles.input, isRtl ? styles.inputRtl : styles.inputLtr]}
              value={radiusKm}
              onChangeText={setRadiusKm}
              onFocus={() => onHistoryFieldFocus('radiusKm')}
              onBlur={() => onHistoryFieldBlur('radiusKm', radiusKm)}
            />
            {renderSuggestions('radiusKm', radiusKm)}
            <Pressable style={styles.secondaryBtn} onPress={loadNearby}>
              <Text style={styles.secondaryBtnText}>{t.findNearby}</Text>
            </Pressable>

            {nearbyChains.map((chain) => (
              <Text key={`${chain.chain}-${chain.nearestBranch}`} style={styles.smallText}>
                {chain.chain} · {chain.nearestBranch} · {chain.nearestDistanceKm.toFixed(2)} km
              </Text>
            ))}

            <View style={[styles.card, { marginTop: 12 }]}> 
              <Text style={styles.sectionTitle}>{t.privacyCompliance}</Text>
              <Text style={styles.smallText}>{t.dataUsed}</Text>
              <Text style={styles.smallText}>{t.purpose}</Text>
              <Text style={styles.smallText}>{t.privacyAcceptance}: {privacyAccepted ? t.accepted : t.notAccepted}</Text>

              <Pressable style={styles.secondaryBtn} onPress={() => void togglePrivacyAcceptance()}>
                <Text style={styles.secondaryBtnText}>{privacyAccepted ? t.revokeAcceptance : t.acceptTerms}</Text>
              </Pressable>

              <Text style={[styles.smallText, { marginTop: 8 }]}>{t.pushPermission}: {pushPermission}</Text>
              <Pressable style={styles.secondaryBtn} onPress={() => void enablePushNotifications()}>
                <Text style={styles.secondaryBtnText}>{t.enablePush}</Text>
              </Pressable>
              {expoPushToken ? <Text style={styles.smallText}>{t.expoToken}: {expoPushToken}</Text> : null}

              <Pressable style={styles.secondaryBtn} onPress={() => void clearAllSavedInputs()}>
                <Text style={styles.secondaryBtnText}>{t.clearSavedInputs}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {activeTab === 'account' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t.account}</Text>
            <Text style={styles.smallText}>{t.email}: {currentUser.email}</Text>
            <Text style={styles.smallText}>{t.role}: {currentUser.role}</Text>
            <Text style={styles.smallText}>{t.familyId}: {currentUser.familyId}</Text>
            <Text style={styles.smallText}>{t.subscriptionTier}: {currentUser.subscriptionTier}</Text>
            <Text style={styles.smallText}>{t.coinsBalance}: {coinsBalance}</Text>
            <Text style={styles.smallText}>{t.monthlyPackage}: {hasMonthlyPackage ? t.active : t.notPurchased}</Text>
            <Text style={styles.smallText}>{t.purchasedPackages}: {purchasedPackages.join(', ') || t.none}</Text>

            {hasMonthlyPackage ? (
              <Pressable style={styles.secondaryBtn} onPress={() => void cancelMonthlyPackage()}>
                <Text style={styles.secondaryBtnText}>{t.cancelSubscription}</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.actionBtn, styles.dangerBtn, { marginTop: 16, alignSelf: 'flex-start' }]}
              onPress={() => {
                if (!supabase) return;
                void supabase.auth.signOut();
              }}
            >
              <Text style={styles.actionBtnText}>{t.logout}</Text>
            </Pressable>
          </View>
        )}

        {!!statusText && <Text style={[styles.infoText, { marginTop: 12 }]}>{statusText}</Text>}
      </ScrollView>

      {isMenuOpen && (
        <View style={styles.drawerLayer}>
          <View style={styles.drawerBackdrop} />
          <Animated.View
            style={[styles.drawerPanel, { width: drawerWidth, transform: [{ translateX: drawerTranslateX }] }]}
          >
            <View style={styles.drawerHandle} />
            {(['account', 'list', 'inventory', 'chat', 'store', 'reports', 'participants', 'settings'] as AppTab[]).map((tab) => (
              <Pressable
                key={tab}
                style={[styles.drawerItemBtn, activeTab === tab && styles.drawerItemBtnActive]}
                onPress={() => onSelectMenuTab(tab)}
              >
                <Text style={styles.drawerItemText}>{tabLabel(tab)}</Text>
              </Pressable>
            ))}
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ebe7f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: '#8b5cf6',
    boxShadow: '0px 8px 14px rgba(91,33,182,0.25)',
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  headerTitle: {
    color: '#ffffff',
  },
  headerSubtitle: {
    color: '#ede9fe',
  },
  drawerLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    elevation: 30,
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#d8c8ff',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    boxShadow: '0px 6px 12px rgba(91,33,182,0.18)',
    elevation: 7,
  },
  menuEdgeButtonText: {
    color: '#5b21b6',
    fontSize: 18,
    fontWeight: '700',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    zIndex: 32,
  },
  drawerPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderLeftWidth: 1,
    borderLeftColor: '#e9ddff',
    paddingTop: 22,
    paddingHorizontal: 14,
    zIndex: 33,
    boxShadow: '0px 8px 18px rgba(15,23,42,0.2)',
    elevation: 10,
  },
  drawerHandle: {
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  drawerItemBtn: {
    borderWidth: 1,
    borderColor: '#e9ddff',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  drawerItemBtnActive: {
    backgroundColor: '#f4efff',
    borderColor: '#8b5cf6',
  },
  drawerItemText: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e9ddff',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    boxShadow: '0px 5px 10px rgba(124,58,237,0.08)',
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7c9fb',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
  },
  inputLtr: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  inputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  datePickerTrigger: {
    justifyContent: 'center',
    width: '100%',
    minHeight: 44,
  },
  datePickerPlaceholderText: {
    color: '#9ca3af',
  },
  datePickerValueText: {
    color: '#0f172a',
  },
  datePickerTextLtr: {
    textAlign: 'left',
  },
  datePickerTextRtl: {
    textAlign: 'right',
  },
  suggestionBox: {
    borderWidth: 1,
    borderColor: '#dacbfd',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    marginTop: -4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1ebff',
  },
  suggestionText: {
    color: '#4338ca',
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: '#6d4fe9',
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryBtn: {
    backgroundColor: '#f4f0ff',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#dacbfd',
  },
  secondaryBtnText: {
    color: '#5b21b6',
    fontWeight: '600',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    backgroundColor: '#f4efff',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#d8c8ff',
  },
  modeBtnActive: {
    backgroundColor: '#e7dbff',
  },
  modeText: {
    color: '#1e293b',
    fontWeight: '600',
  },
  comboWrap: {
    marginBottom: 10,
  },
  authComboBtn: {
    alignSelf: 'flex-end',
    minWidth: 150,
    paddingHorizontal: 18,
  },
  authComboMenu: {
    alignSelf: 'flex-end',
    minWidth: 150,
  },
  authLanguageCorner: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 20,
  },
  comboBtn: {
    borderWidth: 1,
    borderColor: '#dacbff',
    borderRadius: 10,
    backgroundColor: '#f5f1ff',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  comboMenu: {
    borderWidth: 1,
    borderColor: '#dacbff',
    borderRadius: 8,
    marginTop: 6,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  comboOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  authCard: {
    flex: 1,
    margin: 0,
    width: '100%',
    maxWidth: '100%',
    padding: 20,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  authGlowTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.2)',
    top: -120,
    right: -70,
  },
  authGlowBottom: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.14)',
    bottom: -120,
    left: -60,
  },
  authHero: {
    alignItems: 'center',
    marginBottom: 8,
  },
  authIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  authIcon: {
    fontSize: 30,
  },
  authTitle: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 30,
    marginBottom: 4,
  },
  authSubtitle: {
    color: '#ede9fe',
    marginBottom: 10,
    textAlign: 'center',
  },
  authHint: {
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
    color: '#ede9fe',
    fontSize: 12,
  },
  authActionsWrap: {
    marginTop: 16,
  },
  authPrimaryDisabled: {
    opacity: 0.5,
  },
  authLoginBtn: {
    alignSelf: 'center',
    minWidth: 190,
    paddingHorizontal: 24,
  },
  authRegisterBtn: {
    alignSelf: 'center',
    minWidth: 160,
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    marginTop: 8,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  actionBtn: {
    backgroundColor: '#6d4fe9',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dangerBtn: {
    backgroundColor: '#b91c1c',
  },
  smallText: {
    fontSize: 12,
    color: '#5b5670',
    marginBottom: 4,
  },
  infoText: {
    color: '#5b21b6',
    backgroundColor: '#f4efff',
    borderColor: '#d8c8ff',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
  },
});
