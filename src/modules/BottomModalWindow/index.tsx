import React, { useState, useEffect, useRef } from 'react';
import { ModalWithOverlay } from '../../modules/ModalWithOverlay';

import containerStyles from '../../styles/container';
import theme from '../../styles/theme';

import {
	StyleSheet,
	Animated,
	Easing,
} from 'react-native';

interface IBottomModalWindowScreenProps {
	children: React.ReactNode;
	isVisible: boolean,
	onOverlayPress: () => void,
}

export function BottomModalWindow({
  children,
	isVisible,
	onOverlayPress,
}: IBottomModalWindowScreenProps): JSX.Element {
	const animationModalDuration: number = 250;

	const [isBottomModalWindowVisible, setBottomModalWindowVisible] = useState<boolean>(false);
	const [animatedModalViewHeight, setAnimatedModalViewHeight] = useState(0);
	const animatedModalViewRef = useRef<any | null>(null);
	const [animationModal] = useState(new Animated.Value(0));
	const [isShowModal, setShowModal] = useState<boolean>(true);

	useEffect(() => {
		if (isVisible) openBottomModalWindow();
		else closeBottomModalWindow();
	}, [isVisible]);

	const modalAnimation = () => {
		Animated.timing(animationModal, {
			toValue: isShowModal ? 0 : 1,
			duration: animationModalDuration,
			useNativeDriver: true,
			easing: Easing.ease,
		}).start(() => setShowModal(!isShowModal));
	}

	const translateY = animationModal.interpolate({
		inputRange: [0, 1],
		outputRange: [animatedModalViewHeight, 0],
	});

	const animatedStyle = {
		transform: [{
			translateY: translateY,
		}],
	}

	const onLayoutModal = () => {
		if (animatedModalViewRef.current) {
			animatedModalViewRef.current.measure((x: number, y: number, width: number, height: number) => {
				setAnimatedModalViewHeight(height);
			});
		}
	}

	const openBottomModalWindow = () => {
		setBottomModalWindowVisible(true);
		setTimeout(() => modalAnimation(), animationModalDuration);
	}

	const closeBottomModalWindow = () => {
		modalAnimation();
		setTimeout(() => {
			setBottomModalWindowVisible(false);
		}, animationModalDuration);
	}

	return (
		<ModalWithOverlay
			animation="fade"
			transparent={true}
			isVisible={isBottomModalWindowVisible}
			onOverlayPress={() => onOverlayPress()}
		>
			<Animated.View
				style={[containerStyles, styles.bottomModalWindow, animatedStyle]}
				ref={animatedModalViewRef}
				onLayout={() => onLayoutModal()}
			>
        { children }
			</Animated.View>
		</ModalWithOverlay>
	);
}

const styles = StyleSheet.create({
	bottomModalWindow: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		width: '100%',
		paddingTop: 24,
		paddingBottom: 50,
		backgroundColor: theme.colors.surface,
		borderTopLeftRadius: theme.radius.sm,
		borderTopRightRadius: theme.radius.sm,
		zIndex: 100,
	},
});
