import React, { useState, useEffect, useRef, } from 'react';
import { NavigationProp } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { ModalWithOverlay } from '../../modules/ModalWithOverlay';
import { Alert, TAlertButton } from '../../modules/Alert';
import SWords from '../../storage/words/words.service';

import containerStyles from '../../styles/container';
import theme from '../../styles/theme';

import {
	StyleSheet,
	Animated,
	Easing,

} from 'react-native';

interface IGroupFormScreenProps {
	navigation: any,
	isVisible: boolean,
	onClose: () => void,
	onCreate: (groupID?: number | null) => void,
}

export function GroupForm({
	navigation,
	isVisible,
	onClose,
	onCreate,
}: IGroupFormScreenProps): JSX.Element {
	const animationFormDuration: number = 250;

	const [isGroupFormVisible, setGroupFormVisible] = useState<boolean>(false);
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [animatedFormViewHeight, setAnimatedFormViewHeight] = useState(0);
	const animatedFormViewRef = useRef< any | null>(null);
	const [animationForm] = useState(new Animated.Value(0));
	const [isShowForm, setShowForm] = useState<boolean>(true);

	const [isError, setError] = useState<boolean>(false);
	const [isAlertVisible, setAlertVisible] = useState<boolean>(false);
	const [alertMessage, setAlertMessage] = useState<string>('');

	const [groupID, setGroupID] = useState<number | null>(null);
	const [isSuccess, setSuccess] = useState<boolean>(false);
	const [isCancel, setCancel] = useState<boolean>(false);

	useEffect(() => {
		onCreate(groupID);
	}, [groupID])

	useEffect(() => {
		if (isVisible) openGroupForm();
		else closeGroupForm();
	}, [isVisible]);

	const formAnimation = () => {
		Animated.timing(animationForm, {
			toValue: isShowForm ? 0 : 1,
			duration: animationFormDuration,
			useNativeDriver: true,
			easing: Easing.ease,
		}).start(() => setShowForm(!isShowForm));
	}

	const translateY = animationForm.interpolate({
		inputRange: [0, 1],
		outputRange: [animatedFormViewHeight, 0],
	});

	const animatedStyle = {
		transform: [{
			translateY: translateY,
		}],
	}

	const onLayoutForm = () => {
		if (animatedFormViewRef.current) {
			animatedFormViewRef.current.measure((x: number, y: number, width: number, height: number) => {
				setAnimatedFormViewHeight(height);
			});
		}
	}

	const openGroupForm = () => {
		setGroupFormVisible(true);
		setTimeout(() => formAnimation(), animationFormDuration);
	}

	const closeGroupForm = () => {
		formAnimation();
		setTimeout(() => {
			setGroupFormVisible(false);
		}, animationFormDuration);
	}

	const getAlertButtons = (): TAlertButton[] => {
		const buttons: TAlertButton[] = [{
			title: 'Закрыть',
			onPress: () => {
				setAlertVisible(!isAlertVisible);
				if (isError) setError(false);
				if (!isSuccess) return;
				onClose();
				resetForm();
			}
		}];
		if (isCancel) {
			buttons.push({
				title: 'Не сохранять',
				onPress: () => {
					setAlertVisible(false);
					onClose();
					resetForm();
				}
			});
		}
		if (!isError && !isCancel) {
			buttons.push({
				title: 'Добавить слова в группу',
				onPress: () => {
					setAlertVisible(!isAlertVisible);
					navigation.navigate('WordData', { backPathRoute: 'Words', isShowWord: false, groupID: groupID });
				}
			});
		}
		return buttons;
	}

	const saveNewGroup = async (): Promise<string | number> => {
		return new Promise<string | number>((resolve, reject) => {
			try {
				const result = SWords.createGroup(name, description);
				resolve(result);
			} catch (error: any) {
				reject(error);
			}
		});
	}

	const submitGroupForm = async () => {
		if (!name) {
			setError(true);
			setAlertMessage('Введите название группы');
			setAlertVisible(!isAlertVisible);
			return;
		}
		const result = await saveNewGroup();
		if (result === 'duplicate') {
			setAlertMessage('Группа с таким названием уже существует!');
			setError(true);
			setAlertVisible(true);
		}
		if (typeof result === 'number') {
			setSuccess(true);
			setGroupID(result);
			setAlertMessage('Группа cоздана!');
			setError(false);
			setAlertVisible(true);
		}
	}

	const cancel = () => {
		if (!name) return onClose();
		setCancel(true);
		setAlertMessage('Введенные данные не сохраянятся');
		setError(false);
		setAlertVisible(true);
	}

	const resetForm = () => {
		setName('');
		setDescription('');
		setCancel(false);
		setSuccess(false);
	}

	return (
		<ModalWithOverlay
			animation="fade"
			transparent={true}
			isVisible={isGroupFormVisible}
			onOverlayPress={() => onClose()}
		>
			<Alert
				isVisible={isAlertVisible}
				message={alertMessage}
				buttons={getAlertButtons()}
				onOverlayPress={() => setAlertVisible(!isAlertVisible)}
			/>
			<Animated.View
				style={[containerStyles, styles.groupForm, animatedStyle]}
				ref={animatedFormViewRef}
				onLayout={() => onLayoutForm()}
			>
				<Input
					style={styles.input}
					label="Название"
					placeholder="Введите название"
					value={name}
					onChangeText={(name) => setName(name)}
				/>
				<Input
					style={styles.input}
					label="Описание"
					placeholder="Введите описание"
					value={description}
					onChangeText={(description) => setDescription(description)}
				/>
				<Button
					style={{ marginBottom: 15 }}
					title='Сохранить'
					onPress={() => submitGroupForm()}
				/>
				<Button
					title='Отменить'
					onPress={() => cancel()}
				/>
			</Animated.View>
		</ModalWithOverlay>
	);
}

const styles = StyleSheet.create({
	input: {
		marginBottom: 10,
	},

	groupForm: {
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
