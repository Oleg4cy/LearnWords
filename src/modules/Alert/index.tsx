import React from 'react';
import { ModalWithOverlay } from '../ModalWithOverlay';
import { Button } from '../../components/Button';
import theme from '../../styles/theme';

import {
	View,
	Text,
	StyleSheet,
	StyleProp,
	ViewStyle,
} from 'react-native';

export type TAlertButton = {
	style?: StyleProp<ViewStyle>,
	title: string,
	onPress: () => void,
}

interface IAlertProps {
	message: string,
	isVisible: boolean,
	buttons: TAlertButton[],
	style?: StyleProp<ViewStyle>,
	onOverlayPress?: () => void,
}

export function Alert({
	message,
	isVisible,
	buttons,
	style,
	onOverlayPress,
}: IAlertProps): JSX.Element {
	const maxTitleLength = Math.max(...buttons.map(button => button.title.length), 0);
	const buttonWidth = Math.min(Math.max(150, maxTitleLength * 10 + 44), 280);

	return (
		<ModalWithOverlay
			style={style ?? {}}
			transparent={true}
			animation="fade"
			isVisible={isVisible}
			onOverlayPress={() => { if (onOverlayPress) onOverlayPress(); }}
		>
			<View style={styles.container}>
				<Text style={[styles.message, styles.marginBottom]}>{message}</Text>
				{buttons.map((button: TAlertButton, index: number) => (
					<Button
						key={index}
						style={[
							styles.button,
							{ width: buttonWidth },
							(buttons.length - 1 != index) ? styles.marginBottom : {},
							button.style
						]}
						title={button.title}
						onPress={() => button.onPress()}
					/>))}
			</View>
		</ModalWithOverlay>
	);
}

const styles = StyleSheet.create({
	marginBottom: {
		marginBottom: 15,
	},

	container: {
		margin: 20,
		backgroundColor: theme.colors.surface,
		borderRadius: theme.radius.sm,
		padding: 24,
		alignItems: 'center',
		borderWidth: 1,
		borderColor: theme.colors.border,
		...theme.shadow,
	},

	message: {
		color: theme.colors.text,
		fontSize: 18,
		fontWeight: '600',
		textAlign: 'center',
	},

	button: {
		alignSelf: 'center',
	},


	textStyle: {
		color: theme.colors.surface,
		fontWeight: '600',
		textAlign: 'center',
	},
});
