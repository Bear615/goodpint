import { registerRootComponent } from 'expo';

import App from './App';
import { colors } from './src/theme';

if (typeof document !== 'undefined') {
  document.documentElement.style.backgroundColor = colors.background;
  document.body.style.backgroundColor = colors.background;
  document.body.style.margin = '0';

  const root = document.getElementById('root');

  if (root) {
    root.style.backgroundColor = colors.background;
    root.style.minHeight = '100vh';
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
