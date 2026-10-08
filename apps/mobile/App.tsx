import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false, // לא רלוונטי במובייל, וגם חוסך קריאות מיותרות
    },
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      {/* style="light" = אייקוני שורת הסטטוס (שעה, סוללה, קליטה)
          בהירים. על הרקע הכהה של האפליקציה, ברירת המחדל הכהה
          הייתה בלתי-נראית כמעט. */}
      <StatusBar style="light" />
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
