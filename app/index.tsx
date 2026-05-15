import { Redirect } from 'expo-router';

// Entry point: skip auth in this scaffold and land directly on the Jobs tab.
// Replace with a session check once OTP is wired up.
export default function Entry() {
  return <Redirect href="/(tabs)"/>;
}
