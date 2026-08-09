import { useCallback, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme } from '../theme/theme';

import { SplashScreen } from '../screens/Splash/SplashScreen';
import { OnboardingScreen } from '../screens/Onboarding/OnboardingScreen';
import { HomeScreen } from '../screens/Home/HomeScreen';
import { WalletScreen } from '../screens/Wallet/WalletScreen';
import { BenefitsListScreen } from '../screens/Benefits/BenefitsListScreen';
import { BenefitDetailsScreen } from '../screens/BenefitDetails/BenefitDetailsScreen';
import { FavoritesScreen } from '../screens/Favorites/FavoritesScreen';
import { SearchScreen } from '../screens/Search/SearchScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { AboutScreen } from '../screens/About/AboutScreen';
import type { Benefit, Program } from '../api/types';

// כל טאב מקבל Stack פנימי משלו, כדי שניווט לפרטי הטבה מכל טאב
// (Home/Wallet/Search/Favorites כולם יכולים להוביל ל-BenefitDetails)
// ישמור את ה-back button הטבעי של אותו טאב, במקום לקפוץ לטאב אחר.
type BenefitsStackParams = {
  List: undefined;
  Details: { benefit: Benefit };
  Category: { categoryId: string; categoryName: string };
  Program: { program: Program };
};

// Stack ייעודי ל-Search: כולל route נוסף (GroupDetail) שלא קיים
// בשאר הטאבים, כי רק Search פותח קבוצות המלצות (תרחיש "פוקס").
type SearchStackParams = BenefitsStackParams & {
  GroupDetail: { benefits: Benefit[]; title: string };
};

type ProfileStackParams = { Profile: undefined; Settings: undefined; About: undefined };

const HomeStack = createNativeStackNavigator<BenefitsStackParams>();
const WalletStack = createNativeStackNavigator<BenefitsStackParams>();
const SearchStack = createNativeStackNavigator<SearchStackParams>();
const FavoritesStackNav = createNativeStackNavigator<BenefitsStackParams>();
const ProfileStack = createNativeStackNavigator<ProfileStackParams>();
const Tabs = createBottomTabNavigator();

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="List">
        {({ navigation }) => (
          <HomeScreen
            onOpenBenefit={(benefit) => navigation.navigate('Details', { benefit })}
            onOpenCategory={(categoryId, categoryName) => navigation.navigate('Category', { categoryId, categoryName })}
          />
        )}
      </HomeStack.Screen>
      <HomeStack.Screen name="Category">
        {({ route, navigation }) => (
          <BenefitsListScreen
            categoryId={route.params.categoryId}
            categoryName={route.params.categoryName}
            onOpenBenefit={(benefit) => navigation.navigate('Details', { benefit })}
          />
        )}
      </HomeStack.Screen>
      <HomeStack.Screen name="Details">
        {({ route, navigation }) => (
          <BenefitDetailsScreen benefit={route.params.benefit} onBack={() => navigation.goBack()} />
        )}
      </HomeStack.Screen>
    </HomeStack.Navigator>
  );
}

// מקבל onGoToOnboarding כ-prop מלמעלה (מה-RootNavigator) ומעביר
// אותו הלאה ל-WalletScreen — לא מנסה "לקפוץ" דרך React Navigation
// לשכבת ה-state שמנוהלת מחוץ ל-NavigationContainer.
function WalletStackScreen({ onGoToOnboarding }: { onGoToOnboarding: () => void }) {
  return (
    <WalletStack.Navigator screenOptions={{ headerShown: false }}>
      <WalletStack.Screen name="List">
        {({ navigation }) => (
          <WalletScreen
            onOpenProgram={(program) => navigation.navigate('Program', { program })}
            onGoToOnboarding={onGoToOnboarding}
          />
        )}
      </WalletStack.Screen>
      <WalletStack.Screen name="Program">
        {({ route, navigation }) => (
          <BenefitsListScreen
            programId={route.params.program.id}
            programName={route.params.program.name}
            onOpenBenefit={(benefit) => navigation.navigate('Details', { benefit })}
          />
        )}
      </WalletStack.Screen>
      <WalletStack.Screen name="Details">
        {({ route, navigation }) => (
          <BenefitDetailsScreen benefit={route.params.benefit} onBack={() => navigation.goBack()} />
        )}
      </WalletStack.Screen>
    </WalletStack.Navigator>
  );
}

function SearchStackScreen() {
  return (
    <SearchStack.Navigator screenOptions={{ headerShown: false }}>
      <SearchStack.Screen name="List">
        {({ navigation }) => (
          <SearchScreen
            onOpenBenefit={(benefit) => navigation.navigate('Details', { benefit })}
            onOpenCategory={(categoryId, categoryName) => navigation.navigate('Category', { categoryId, categoryName })}
            onOpenBenefitGroup={(group, title) => navigation.navigate('GroupDetail', { benefits: group.benefits, title })}
          />
        )}
      </SearchStack.Screen>
      <SearchStack.Screen name="Category">
        {({ route, navigation }) => (
          <BenefitsListScreen
            categoryId={route.params.categoryId}
            categoryName={route.params.categoryName}
            onOpenBenefit={(benefit) => navigation.navigate('Details', { benefit })}
          />
        )}
      </SearchStack.Screen>
      <SearchStack.Screen name="GroupDetail">
        {({ route, navigation }) => (
          <BenefitsListScreen
            staticBenefits={route.params.benefits}
            staticTitle={route.params.title}
            onOpenBenefit={(benefit) => navigation.navigate('Details', { benefit })}
          />
        )}
      </SearchStack.Screen>
      <SearchStack.Screen name="Details">
        {({ route, navigation }) => (
          <BenefitDetailsScreen benefit={route.params.benefit} onBack={() => navigation.goBack()} />
        )}
      </SearchStack.Screen>
    </SearchStack.Navigator>
  );
}

function FavoritesStackScreen() {
  return (
    <FavoritesStackNav.Navigator screenOptions={{ headerShown: false }}>
      <FavoritesStackNav.Screen name="List">
        {({ navigation }) => <FavoritesScreen onOpenBenefit={(benefit) => navigation.navigate('Details', { benefit })} />}
      </FavoritesStackNav.Screen>
      <FavoritesStackNav.Screen name="Details">
        {({ route, navigation }) => (
          <BenefitDetailsScreen benefit={route.params.benefit} onBack={() => navigation.goBack()} />
        )}
      </FavoritesStackNav.Screen>
    </FavoritesStackNav.Navigator>
  );
}

// אותו עיקרון: onGoToOnboarding מגיע כ-prop מלמעלה, לא מנוחש
// דרך ניווט. SettingsScreen מקבל אותו ישירות, ולא צריך לדעת כלום
// על מבנה ה-Tabs/RootNavigator שמעליו.
function ProfileStackScreen({ onGoToOnboarding }: { onGoToOnboarding: () => void }) {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="Profile">{() => <ProfileScreen />}</ProfileStack.Screen>
      <ProfileStack.Screen name="Settings">
        {({ navigation }) => (
          <SettingsScreen onEditPrograms={onGoToOnboarding} onOpenAbout={() => navigation.navigate('About')} />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="About">
        {({ navigation }) => <AboutScreen onBack={() => navigation.goBack()} />}
      </ProfileStack.Screen>
    </ProfileStack.Navigator>
  );
}

// הערה מתועדת: CategoriesScreen לא מקבל טאב עצמאי משלו בתחתית.
// עם 5 טאבים (Home/Wallet/Search/Favorites/Profile) כבר יש כניסה
// לקטגוריות דרך Home ודרך Search. זו החלטת UX מודעת, לא השמטה —
// טאב שישי ניתן להוספה בקלות אם שימוש אמיתי יראה שצריך.
function TabsScreen({ onGoToOnboarding }: { onGoToOnboarding: () => void }) {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.purple,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tabs.Screen name="HomeTab" options={{ tabBarLabel: 'בית' }}>
        {() => <HomeStackScreen />}
      </Tabs.Screen>
      <Tabs.Screen name="WalletTab" options={{ tabBarLabel: 'ארנק' }}>
        {() => <WalletStackScreen onGoToOnboarding={onGoToOnboarding} />}
      </Tabs.Screen>
      <Tabs.Screen name="SearchTab" options={{ tabBarLabel: 'חיפוש' }}>
        {() => <SearchStackScreen />}
      </Tabs.Screen>
      <Tabs.Screen name="FavoritesTab" options={{ tabBarLabel: 'מועדפים' }}>
        {() => <FavoritesStackScreen />}
      </Tabs.Screen>
      <Tabs.Screen name="ProfileTab" options={{ tabBarLabel: 'שלי' }}>
        {() => <ProfileStackScreen onGoToOnboarding={onGoToOnboarding} />}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

type RootState = 'splash' | 'onboarding' | 'main';

// שכבת השורש: מנהלת את המעבר בין Splash -> Onboarding -> Main
// כ-state מקומי פשוט, לא כחלק מעץ ה-React Navigation — כי זה
// מעבר חד-פעמי/נדיר (לא ניווט רגיל), ופתרון עם state מפורש כאן
// הוא הדרך היחידה לתת ל-SettingsScreen "לקפוץ החוצה" בחזרה
// ל-Onboarding בלי לבנות תלות מעגלית בין הניווטים.
export function RootNavigator() {
  const [state, setState] = useState<RootState>('splash');

  const handleSplashReady = useCallback((hasCompletedOnboarding: boolean) => {
    setState(hasCompletedOnboarding ? 'main' : 'onboarding');
  }, []);

  const handleOnboardingDone = useCallback(() => setState('main'), []);
  const handleGoToOnboarding = useCallback(() => setState('onboarding'), []);

  if (state === 'splash') return <SplashScreen onReady={handleSplashReady} />;
  if (state === 'onboarding') return <OnboardingScreen onDone={handleOnboardingDone} />;

  return (
    <NavigationContainer>
      <TabsScreen onGoToOnboarding={handleGoToOnboarding} />
    </NavigationContainer>
  );
}
