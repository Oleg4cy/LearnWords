import React, { useRef, useState } from 'react';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Header } from '../../modules/Header';
import { Alert, TAlertButton } from '../../modules/Alert';
import SWords from '../../storage/words/words.service';
import { TTranslate, TWord } from '../../storage/words/words.types';
import Icon from 'react-native-vector-icons/FontAwesome';
import IconsStrings from '../../assets/awesomeIcons';
import { Button } from '../../components/Button';

import buttonBottomFreeze, { buttonBottomFreezeText } from '../../styles/buttonBottomFreeze';
import containerStyles from '../../styles/container';
import theme from '../../styles/theme';

import {
	SafeAreaView,
	View,
	StyleSheet,
	ScrollView,
	Text,
	TouchableOpacity,
} from 'react-native';

interface IWordsListScreenProps {
	navigation: StackNavigationProp<any>,
}

type RootStackParamList = {
	WordsList: {
		groupID?: number | null,
		listMode?: 'group' | 'withoutGroup' | 'all',
		groupName?: string,
		refreshKey?: number,
	};
};

export function WordsList({ navigation }: IWordsListScreenProps): JSX.Element {
	const route = useRoute<RouteProp<RootStackParamList, 'WordsList'>>();
	const listMode = route.params?.listMode ?? (
		route.params?.groupID === 0
			? 'all'
			: route.params?.groupID
				? 'group'
				: 'withoutGroup'
	);
	const groupID = listMode === 'all'
		? 0
		: listMode === 'withoutGroup'
			? null
			: route.params?.groupID ?? null;
	const refreshKey = route.params?.refreshKey ?? 0;
	const title = route.params?.groupName
		?? (listMode === 'all'
			? 'Все слова'
			: listMode === 'withoutGroup'
				? 'Слова без групп'
				: 'Группа');

	const startArr: TWord[] = [];
	const [words, setWords] = useState<TWord[]>(startArr);

	const [wordToRemove, setWordToRemove] = useState<TWord | null>(null);
	const [isAlertVisible, setAlertVisible] = useState<boolean>(false);
	const [selectedWordIDs, setSelectedWordIDs] = useState<number[]>([]);
	const [isBulkDeleteAlertVisible, setBulkDeleteAlertVisible] = useState<boolean>(false);
	const isLongPressRef = useRef<boolean>(false);

  useFocusEffect(
    React.useCallback(() => {
      fetchWords(groupID);
      return () => {};
    }, [groupID, refreshKey])
  );

	const fetchWords = async (activeGroupID: number | null) => {
		try {
			let words = await SWords.getWordsList(activeGroupID);
			words = words.sort((a, b) => a.word.localeCompare(b.word));
			setWords(words);
		} catch (error) {
			console.log(error);
      throw error;
		}
	}


		const removeWord = async (word: TWord) => {
			if (word.id) {
				setWords(words.filter(item => item.id !== word.id));
				await SWords.removeByID(word.id);
			}
		}

		const isSelectionMode = selectedWordIDs.length > 0;

		const toggleWordSelection = (id?: number) => {
			if (!id) return;
			setSelectedWordIDs(prevSelectedIDs => {
				if (prevSelectedIDs.includes(id)) {
					return prevSelectedIDs.filter(selectedID => selectedID !== id);
				}
				return [...prevSelectedIDs, id];
			});
		}

		const openWord = (word: TWord) => {
			navigation.push(
				'WordData',
				{
					isShowWord: true,
					wordID: word.id,
          groupID: groupID,
				}
			);
		}

		const handleWordPress = (word: TWord) => {
			if (isLongPressRef.current) {
				isLongPressRef.current = false;
				return;
			}
			if (isSelectionMode) {
				toggleWordSelection(word.id);
				return;
			}
			openWord(word);
		}

		const removeSelectedWords = async () => {
			try {
				await Promise.all(selectedWordIDs.map((wordID: number) => SWords.removeByID(wordID)));
				setWords(words.filter((word: TWord) => !word.id || !selectedWordIDs.includes(word.id)));
				setSelectedWordIDs([]);
				setBulkDeleteAlertVisible(false);
			} catch (error) {
				console.log(error);
				setBulkDeleteAlertVisible(false);
			}
		}

		return (
			<SafeAreaView style={styles.container}>
			<Header 
        backPath={() => navigation.goBack()} 
        rightIcon={{
          type: IconsStrings.plus,
	          onPress: () => navigation.push(
						'WordEdit',
						{
	            groupID: groupID,
						isNewWord: true,
					}
				),
        }}
	      />
				{isSelectionMode && (
					<View style={[styles.actions, containerStyles]}>
						<Button
							title={`Удалить (${selectedWordIDs.length})`}
							style={styles.deleteButton}
							onPress={() => setBulkDeleteAlertVisible(true)}
						/>
						<Button
							title="Отмена"
							style={styles.cancelSelectionButton}
							textStyle={styles.cancelSelectionButtonText}
							onPress={() => setSelectedWordIDs([])}
						/>
					</View>
				)}
				<ScrollView contentContainerStyle={[styles.scrollViewContent, containerStyles]}>
					<Text style={styles.title}>{title}</Text>
					{words.map((word: TWord) => {
						const isSelected = Boolean(word.id && selectedWordIDs.includes(word.id));
						return (
						<TouchableOpacity
							key={word.id}
							style={[
								styles.rowContainer,
								isSelected && styles.rowContainerSelected,
							]}
							onPress={() => handleWordPress(word)}
							onLongPress={() => {
								isLongPressRef.current = true;
								toggleWordSelection(word.id);
							}}
						>
							<View
								style={styles.wordContainer}
							>
								<Text style={styles.wordText}>{word.word}</Text>
							</View>
							{isSelected ? (
								<Text style={styles.selectedMark}>✓</Text>
							) : (
							<TouchableOpacity style={{ padding: 5 }} onPress={() => {
								setWordToRemove(word);
								setAlertVisible(!isAlertVisible);
							}}>
								<Icon name={IconsStrings.remove} size={20} color={theme.colors.textMuted} />
							</TouchableOpacity>
							)}
						</TouchableOpacity>
					)})}
				</ScrollView>
	      {!isSelectionMode && (
	      <Button
	        style={buttonBottomFreeze}
	        textStyle={buttonBottomFreezeText}
        title='Учить'
        onPress={() => navigation.push(
            'WordData',
            {
              wordID: words[0].id,
              groupID: groupID,
            }
	          )}
	      />
	      )}
				<Alert
				isVisible={isAlertVisible}
				message='Удалить слово из словаря?'
				onOverlayPress={() => setAlertVisible(!isAlertVisible)}
				buttons={[
					{
						title: 'Удалить',
						onPress: () => {
							wordToRemove && removeWord(wordToRemove);
							setAlertVisible(!isAlertVisible);
						}
					},
					{
						title: 'Отмена',
						onPress: () => {
							setAlertVisible(!isAlertVisible);
						}
					}
					]}
				/>
				<Alert
					isVisible={isBulkDeleteAlertVisible}
					message="Удалить выбранные слова?"
					onOverlayPress={() => setBulkDeleteAlertVisible(false)}
					buttons={[
						{
							title: 'Удалить',
							onPress: () => removeSelectedWords(),
						},
						{
							title: 'Отмена',
							onPress: () => setBulkDeleteAlertVisible(false),
						}
					]}
				/>
			</SafeAreaView>
		);
	}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: theme.colors.appBackground,
	},

	scrollViewContent: {
    paddingTop: 10,
    paddingBottom: 76,
		flexGrow: 1,
	},

	title: {
		marginBottom: 14,
		color: theme.colors.text,
		fontSize: 20,
		fontWeight: '700',
	},

	rowContainer: {
		width: '100%',
		marginBottom: 8,
		minHeight: 58,
		paddingLeft: 14,
		paddingRight: 8,
		display: 'flex',
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		backgroundColor: theme.colors.surface,
		borderRadius: theme.radius.sm,
		borderWidth: 1,
		borderColor: theme.colors.border,
		...theme.shadow,
	},

	rowContainerSelected: {
		borderWidth: 2,
		borderColor: theme.colors.primary,
		backgroundColor: theme.colors.primarySoft,
	},

	wordContainer: {
		flex: 1,
		paddingVertical: 15,
	},

	wordText: {
		color: theme.colors.text,
		fontSize: 16,
		fontWeight: '600',
	},

	removeButton: {
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'transparent',
	},

	selectedMark: {
		width: 34,
		height: 28,
		overflow: 'hidden',
		borderRadius: theme.radius.xs,
		backgroundColor: theme.colors.primary,
		color: theme.colors.surface,
		fontSize: 16,
		fontWeight: '700',
		textAlign: 'center',
		textAlignVertical: 'center',
	},

	actions: {
		flexDirection: 'row',
		columnGap: 10,
		marginBottom: 10,
	},

	deleteButton: {
		flex: 1,
		backgroundColor: theme.colors.danger,
	},

	cancelSelectionButton: {
		flex: 1,
		borderWidth: 2,
		borderColor: theme.colors.primary,
		backgroundColor: theme.colors.surface,
	},

	cancelSelectionButtonText: {
		color: theme.colors.primary,
		fontSize: 15,
		fontWeight: '700',
	},
});
