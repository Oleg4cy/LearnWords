import React, { useState } from 'react';
import Icon from 'react-native-vector-icons/FontAwesome';
import theme from '../../styles/theme';

import {
	View,
	TextInput,
	Text,
	StyleSheet,
	StyleProp,
	ViewStyle,
} from 'react-native';

interface IInputProps {
	ref?: any;
	onLayout?: () => void;
	onChangeText: (text: string) => void;
	label?: string;
	value?: string;
	placeholder?: string;
	style?: StyleProp<ViewStyle>;
	focusedStyle?: any;
	multiline?: boolean;
	numberOfLines?: number;
	disabled?: boolean;
	icon?: {
		front?: boolean,
		type: string,
		style?: object,
		onPress?: () => void,
	},
}

export function Input({
	label,
	value,
	placeholder,
	style,
	focusedStyle,
	multiline,
	numberOfLines,
	icon,
	disabled,
	onChangeText,
	onLayout,
}: IInputProps): JSX.Element {
	const [isFocused, setIsFocused] = useState(false);

	const handleFocus = () => {
		setIsFocused(true);
	};

	const handleBlur = () => {
		setIsFocused(false);
	};

	const inputTemplate = () => {
		return (
			<TextInput
				style={[styles.textInput]}
				placeholder={placeholder}
				placeholderTextColor={theme.colors.textSoft}
				value={value}
				onChangeText={onChangeText}
				onFocus={handleFocus}
				onBlur={handleBlur}
				multiline={multiline}
				numberOfLines={numberOfLines}
				onLayout={onLayout}
				editable={!disabled}
			/>
		);
	}

	const pressIcon = () => {
		if (icon && icon.onPress) {
			icon.onPress();
		}
	}

	const getIcon = () => {
		if (!icon) return;
		return <Icon
			name={icon.type}
			size={16}
			color={theme.colors.textMuted}
			style={[styles.icon, icon.style]}
			onPress={() => pressIcon()}
		/>
	}

	const getInput = () => {
		return (
			<View style={[styles.inputRow]}>
				{icon && icon.front && getIcon()}
				<View
					style={[
						styles.inputStyle,
						multiline ? styles.textArea : styles.input,
						isFocused && styles.inputFocused,
						focusedStyle,
						styles.inputContainer,
					]}
				>
					{inputTemplate()}
				</View>
				{icon && !icon.front && getIcon()}
			</View>
		);
	}

	return (
		<View style={[styles.container, style]}>
			{label && <Text style={styles.label}>{label}:</Text>}
			{getInput()}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		width: '100%',
	},

	inputContainer: {
		paddingBottom: 8,
		paddingTop: 8,
		justifyContent: 'center',
	},

	label: {
		marginBottom: 7,
		fontSize: 13,
		fontWeight: '600',
		color: theme.colors.textMuted,
	},

	inputRow: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center',
	},

	inputStyle: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.sm,
		backgroundColor: theme.colors.surface,
		paddingHorizontal: 12,
		flexGrow: 1,
	},

	input: {
		height: 44,
	},

	textArea: {
		//minHeight: 84,
		paddingTop: 10,
	},

	inputFocused: {
		borderColor: theme.colors.primary,
		backgroundColor: theme.colors.surface,
	},

	textInput: {
		paddingTop: 0,
		paddingBottom: 0,
		color: theme.colors.text,
		fontSize: 15,
	},

	icon: {
		flexShrink: 1,
	},
});

