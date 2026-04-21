import React from 'react';

import {
	View,
	Modal,
	StyleSheet,
	StyleProp,
	ViewStyle,
	TouchableWithoutFeedback,
} from 'react-native';
import theme from '../../styles/theme';

interface IModalWithOverlayProps {
	animation: "none" | "fade" | "slide",
	children: React.ReactNode;
	isVisible: boolean,
	overlayStyle?: StyleProp<ViewStyle>,
	transparent: boolean,
	style?: StyleProp<ViewStyle>,
	onOverlayPress?: () => void,
}

export function ModalWithOverlay({
	children,
	animation,
	isVisible,
	overlayStyle,
	transparent = false,
	style,
	onOverlayPress,
}: IModalWithOverlayProps): JSX.Element {
	return (
		<Modal
			style={style ?? {}}
			animationType={animation ?? "none"}
			transparent={transparent}
			visible={isVisible}
		>
			<View style={styles.centeredView}>
				<TouchableWithoutFeedback onPress={() => { if (onOverlayPress) onOverlayPress(); }} >
					<View style={[styles.overlay, overlayStyle]} />
				</TouchableWithoutFeedback>
				{children}
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: theme.colors.overlay,
	},

	centeredView: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},

});

