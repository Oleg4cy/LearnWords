import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import Navigation from './src/navigation/Navigation';
import { Appearance } from 'react-native';
import SWords from './src/storage/words/words.service';

function App(): JSX.Element {
  SWords.getInstance();
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
