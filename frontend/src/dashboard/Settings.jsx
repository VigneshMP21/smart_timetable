import SetupPage from '../components/setup/SetupPage';

/**
 * Settings - Setup route entry point.
 *
 * The full timetable configuration engine lives in SetupPage
 * (components/setup). This thin wrapper keeps the existing /settings
 * route and lazy import intact without holding any page state.
 */
export default function Settings() {
  return <SetupPage />;
}
