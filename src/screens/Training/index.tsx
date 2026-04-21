import React from 'react';
import { StackNavigationProp } from '@react-navigation/stack';
import { CenteredContent } from '../../modules/CenteredContent';
import { Button } from '../../components/Button';

import containerStyles from '../../styles/container';

import {
	StyleSheet,
} from 'react-native';

interface ITrainingScreenProps {
	navigation: StackNavigationProp<any>,
}

export function Training ({ navigation }: ITrainingScreenProps): JSX.Element {
	return (
		<CenteredContent navigation={navigation} header={true} >
			<Button title='Режим теста' onPress={() => navigation.push('TestMode')} />
			<Button title='Режим ввода' onPress={() => navigation.push('InputMode')} />
		</CenteredContent>
	);
}

// <Button title='Назад' onPress={() => navigation.navigate('Home')} />
const styles = StyleSheet.create({
	section: {
		flex: 1,
		justifyContent: 'center',
		rowGap: 20,
		...containerStyles
	},
});


