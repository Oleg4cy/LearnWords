import React from 'react';
import type { PropsWithChildren } from 'react';
import Icon from 'react-native-vector-icons/FontAwesome';
import theme from '../../styles/theme';

import {
	Text,
	TouchableNativeFeedback,
	View,
	StyleSheet,
	StyleProp,
	ViewStyle,
} from 'react-native';

export type IButtonProps = PropsWithChildren<{
	title: string,
	onPress: () => void,
	style?: StyleProp<ViewStyle>,
	textStyle?: object,
	disabled?: boolean,
	icon?: {
		front?: boolean,
		type: string,
		color?: string,
		style?: object,
	},
}>;

export const Button = ({
	title,
	onPress,
	style,
	textStyle,
	icon,
	disabled
}: IButtonProps) => {
	const handlePress = () => {
		if (!disabled) {
			onPress();
		}
	};

	const getIcon = () => {
		if (!icon) return null;
		return <Icon name={icon.type} size={16} color={icon.color ?? theme.colors.surface} style={icon.style ?? {}} />;
	};

	const buttonStyles = [
		styles.button,
		disabled && styles.disabledButton,
		style,
	];

	return (
		<TouchableNativeFeedback onPress={handlePress} disabled={disabled}>
			<View style={buttonStyles}>
				{icon && icon.front && getIcon()}
				<Text style={[styles.buttonText, textStyle]}>{title}</Text>
				{icon && !icon.front && getIcon()}
			</View>
		</TouchableNativeFeedback>
	);
};

const styles = StyleSheet.create({
	button: {
		minHeight: 46,
		borderRadius: theme.radius.sm,
		paddingVertical: 12,
		paddingHorizontal: 16,
		overflow: 'hidden',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: theme.colors.primary,
		columnGap: 8,
	},

	disabledButton: {
		backgroundColor: theme.colors.disabled,
	},

	buttonText: {
		color: theme.colors.surface,
		fontSize: 15,
		fontWeight: '600',
		textAlign: 'center',
	},
});
