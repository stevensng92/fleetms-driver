// Jest setup, runs before each test file.
//
// Native modules that have no JS implementation under the jest-expo preset get
// stubbed here rather than in individual tests, so a component test never has
// to know which native dependency sits three levels below it.

// AsyncStorage has no native module under Jest, and ThemeProvider imports it at
// module scope — so ANY component test transitively importing useTokens dies
// without this. Library ships its own mock for exactly this reason.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Safe-area insets come from a native module. AppFrame calls useSafeAreaInsets
// at the top of every screen, so screen tests throw "No safe area value
// available" without this. The library's own mock returns zero insets.
// `.default` matters: the shipped mock is `export default {...}`, so requiring
// it without unwrapping yields a module whose useSafeAreaInsets is undefined.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// expo-haptics: fire-and-forget native calls from Button/press handlers.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Sentry: lib/queries/*.ts call captureMessage on unknown enum values. Left as
// a spy rather than a no-op so a test can assert the warning fired.
jest.mock('@sentry/react-native', () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  init: jest.fn(),
  wrap: (c: unknown) => c,
}));

// Silence the RN Animated "useNativeDriver is not supported" warning that
// StatusPill's pulse animation emits in the test environment.
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), { virtual: true });
