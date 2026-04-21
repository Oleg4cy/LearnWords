import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Home } from '../../screens/Home';

import { Dictionary } from '../../screens/Dictionary';
import { WordData } from '../../screens/WordData';
import { WordEdit } from '../../screens/WordEdit';
import { WordsList } from '../../screens/WordsList';
import { WordsGroups } from '../../screens/WordsGroups';

import { Training } from '../../screens/Training';
import { TestMode } from '../../screens/TestMode';
import { InputMode } from '../../screens/InputMode';

const Stack = createNativeStackNavigator();

export default function Navigation(): JSX.Element {
	return (
		<NavigationContainer>
			<Stack.Navigator initialRouteName="Home">
				<Stack.Screen name="Home" component={Home} options={{ headerShown: false }} />

				<Stack.Screen name="Dictionary" component={Dictionary} options={{ headerShown: false }} />
				<Stack.Screen name="WordData" component={WordData} options={{ headerShown: false }} />
				<Stack.Screen name="WordEdit" component={WordEdit} options={{ headerShown: false }} />
				<Stack.Screen name="WordsList" component={WordsList} options={{ headerShown: false }} />
				<Stack.Screen name="WordsGroups" component={WordsGroups} options={{ headerShown: false }} />

				<Stack.Screen name="Training" component={Training} options={{ headerShown: false }} />
				<Stack.Screen name="TestMode" component={TestMode} options={{ headerShown: false }} />
				<Stack.Screen name="InputMode" component={InputMode} options={{ headerShown: false }} />
			</Stack.Navigator>
		</NavigationContainer>
	);
}


