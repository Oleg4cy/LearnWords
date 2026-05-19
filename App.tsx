import React, { useEffect } from 'react';
import { Appearance, DevSettings, StatusBar, useColorScheme } from 'react-native';
import Navigation from './src/navigation/Navigation';
import SWords from './src/storage/words/words.service';

function App(): JSX.Element {
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    SWords.getInstance();

    if (__DEV__) {
      if (typeof DevSettings.addMenuItem === 'function') {
        DevSettings.addMenuItem('Reset local DB (dev only)', async () => {
          try {
            await SWords.resetForDevelopment('RESET_LEARNWORDS_DEV_DB');
            DevSettings.reload();
          } catch (error) {
            console.log(error);
          }
        });
      }

      (globalThis as typeof globalThis & {resetLearnWordsDevDb?: () => Promise<void>}).resetLearnWordsDevDb =
        async () => {
          await SWords.resetForDevelopment('RESET_LEARNWORDS_DEV_DB');
          DevSettings.reload();
        };
    }
  }, []);

  Appearance.setColorScheme('light');
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <>
      <StatusBar
        translucent
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
      />
      <Navigation />
    </>
  );
}



export default App;
