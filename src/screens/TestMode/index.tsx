import React, { useState, useEffect } from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Button } from '../../components/Button';
import { Header } from '../../modules/Header';
import { Alert, TAlertButton } from '../../modules/Alert';
import SWords from '../../storage/words/words.service';
import { TTranslate, TWord } from '../../storage/words/words.types';
import shuffle from '../../helpers/shuffleArray';

import containerStyles from '../../styles/container';
import buttonBottomFreeze, { buttonBottomFreezeText } from '../../styles/buttonBottomFreeze';
import theme from '../../styles/theme';

import {
	SafeAreaView,
	Text,
	ScrollView,
	TouchableOpacity,
	StyleSheet,
} from 'react-native';

interface ITestModeScreenProps {
	navigation: StackNavigationProp<any>;
}

type RootStackParamList = {
	TestMode: {
		groupID?: number,
		groupName?: string,
	},
};

type TAnswer = TTranslate & {
	correct: boolean,
	selected: boolean,
}

export function TestMode({ navigation }: ITestModeScreenProps): JSX.Element {
	const route = useRoute<RouteProp<RootStackParamList, 'TestMode'>>();
	const groupID = route.params?.groupID ?? 0;

	const [isAlertVisible, setAlertVisible] = useState(false);
	const [activeWord, setActiveWord] = useState<TWord | null>(null);
	const [correctAnswers, setCorrectAnswers] = useState<TAnswer[]>([]);
	const [inCorrectAnswers, setInCorrectAnswers] = useState<TAnswer[]>([]);
	const [activeAnswers, setActiveAnswers] = useState<TAnswer[]>([]);
	const [isAnyAnswerSelected, setIsAnyAnswerSelected] = useState(false);
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		fetchWord();
	}, []);

	useEffect(() => {
		if (activeWord) {
			getCorrectAnswer();
			fetchRandomAnswers();
		}
	}, [activeWord]);

	useEffect(() => {
		if (correctAnswers && inCorrectAnswers) getAnswers();
	}, [correctAnswers, inCorrectAnswers]);

	useEffect(() => {
	}, [activeAnswers]);

	const getAnswers = () => {
		const answers: TAnswer[] = [
			...correctAnswers,
			...inCorrectAnswers.slice(0, 6 - correctAnswers.length)
		];
		setActiveAnswers(shuffle(answers));
	}

	const fetchWord = async () => {
		const word = await SWords.getRandom(groupID);
		if (word) setActiveWord(word);
	}

	const getCorrectAnswer = async () => {
		if (!activeWord) return;
		const answersArr = getRandomFromArr(activeWord.translate);
		const answers: TAnswer[] = setCorrect(answersArr, true);
		setCorrectAnswers(answers);
	}

	const fetchRandomAnswers = async () => {
		if (activeWord && activeWord.id) {
			let answersArr = await SWords.getRandomAnswers(activeWord.id, groupID);
			const answers: TAnswer[] = setCorrect(answersArr, false);
			setInCorrectAnswers(answers);
		}
	}

	const setCorrect = (arr: TTranslate[], value: boolean): TAnswer[] => {
		return arr.reduce((acc: TAnswer[], answer: TTranslate) => {
			acc.push({ ...answer, correct: value, selected: false });
			return acc;
		}, []);
	}

	function getRandomFromArr<T>(array: T[]): T[] {
		const count = Math.floor(Math.random() * array.length) + 1;
		const shuffledArray = shuffle(array);
    const toSlice = Math.min(count, shuffledArray.length);
		return shuffledArray.slice(0, toSlice);
	}

	const handleAnswerClick = (index: number) => {
		if (checked) return;
		setActiveAnswers(prevAnswers => {
			const updatedAnswers = [...prevAnswers];
			updatedAnswers[index].selected = !updatedAnswers[index].selected;
			const selected = updatedAnswers.some(answer => answer.selected);
			if (selected) setIsAnyAnswerSelected(true);
			else setIsAnyAnswerSelected(false);
			return updatedAnswers;
		});
	}

	const getModalButtons = (): TAlertButton[] => {
		const buttons: TAlertButton[] = [
			{
				title: 'Прервать',
				onPress: () => {
					setAlertVisible(!isAlertVisible);
					navigation.goBack();
				},
			},
			{
				title: 'Продолжить',
				onPress: () => {
					setAlertVisible(!isAlertVisible);
				},
			}
		];
		return buttons;
	}

	const computedAnswerStyles = (answer: TAnswer) => {
		if (checked) {
			if (answer.correct) return styles.correctAnswer;
			if (answer.selected && !answer.correct) return styles.inCorrectAnswer;
		} else {
			return answer.selected ? styles.selectedAnswer : styles.unselectedAnswer;
		}
	}

	const reset = () => {
		setActiveWord(null);
		setCorrectAnswers([]);
		setInCorrectAnswers([]);
		setActiveAnswers([]);
		setIsAnyAnswerSelected(false);
		setChecked(false);
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<Header backPath={() => setAlertVisible(true)} />
			<Text style={styles.word}>{activeWord?.word}</Text>
			<ScrollView style={containerStyles}>
				{activeAnswers.map((answer, index) => (
					<TouchableOpacity
						key={index}
						disabled={checked}
						onPress={() => handleAnswerClick(index)}
						style={[
							styles.answerContainer,
							computedAnswerStyles(answer),
						]}
					>
						<Text
							style={[
								styles.answerText,
								answer.selected ? styles.selectedAnswerText : null,
								answer.correct && checked ? styles.correctAnswerText : null
							]}>{answer.value}</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
			<Button
				style={buttonBottomFreeze}
				textStyle={buttonBottomFreezeText}
				disabled={!isAnyAnswerSelected}
				title={checked ? "Следующее слово" : "Проверить"}
				onPress={() => {
					if (checked) {
						reset();
						fetchWord();
					} else setChecked(true);
				}}
			/>
			<Alert
				isVisible={isAlertVisible}
				message="Прервать тренировку?"
				buttons={getModalButtons()}
				onOverlayPress={() => setAlertVisible(!isAlertVisible)}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: theme.colors.appBackground,
	},

	flex: {
		flex: 1,
	},

	word: {
		width: '100%',
		marginBottom: 18,
		color: theme.colors.text,
		fontSize: 24,
		fontWeight: '700',
		textAlign: 'center',
	},

	answerContainer: {
		minHeight: 54,
		paddingVertical: 14,
		paddingHorizontal: 16,
		marginVertical: 6,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: theme.colors.border,
		backgroundColor: theme.colors.surface,
		justifyContent: 'center',
	},

	selectedAnswer: {
		borderWidth: 2,
		borderColor: theme.colors.primary,
		backgroundColor: theme.colors.surface,
	},

	correctAnswer: {
		borderWidth: 2,
		borderColor: theme.colors.success,
		backgroundColor: theme.colors.successSoft,
	},

	inCorrectAnswer: {
		borderWidth: 2,
		borderColor: theme.colors.danger,
		backgroundColor: theme.colors.surface,
	},

	unselectedAnswer: {
		// backgroundColor: 'gray',
	},

	answerText: {
		color: theme.colors.text,
		fontSize: 16,
		fontWeight: '600',
	},

	selectedAnswerText: {
		color: theme.colors.primary,
	},

	correctAnswerText: {
		color: theme.colors.success,
	},

});
