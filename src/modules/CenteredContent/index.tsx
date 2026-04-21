import React from 'react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Header } from '../../modules/Header';
import containerStyles from '../../styles/container';
import centeredStyles from '../../styles/centeredContent';
import theme from '../../styles/theme';

import {
	View,
	StyleSheet,
} from 'react-native';

interface IWordsScreenProps {
	navigation: StackNavigationProp<any>;
	children: React.ReactNode;
	backPath?: string,
	header?: boolean;
}

export const CenteredContent = ({ navigation, children, header }: IWordsScreenProps): JSX.Element => {
	return (
		<View style={styles.content}>
			<View style={styles.header}>
				{header && <Header backPath={() => navigation.goBack()} /> }
			</View>
			<View style={[containerStyles, centeredStyles, { paddingBottom: 0 }]}>
				{children}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	content: {
		height: '100%',
		backgroundColor: theme.colors.appBackground,
	},

	header: {
		position: 'absolute',
		zIndex: 1,
	}
});

