import React, { useState } from 'react';
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

	const startArr: TWord[] = [];
	const [words, setWords] = useState<TWord[]>(startArr);

	const [wordToRemove, setWordToRemove] = useState<TWord | null>(null);
	const [isAlertVisible, setAlertVisible] = useState<boolean>(false);

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
			SWords.removeByID(word.id);
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
			<ScrollView contentContainerStyle={[styles.scrollViewContent, containerStyles]}>
				{words.map((word: TWord) => (
					<View key={word.id} style={styles.rowContainer} >
						<TouchableOpacity
							style={styles.wordContainer}
							onPress={() => navigation.push(
								'WordData',
								{
									isShowWord: true,
									wordID: word.id,
                  groupID: groupID,
								}
							)}
						>
							<Text style={styles.wordText}>{word.word}</Text>
						</TouchableOpacity>
						<TouchableOpacity style={{ padding: 5 }} onPress={() => {
							setWordToRemove(word);
							setAlertVisible(!isAlertVisible);
						}}>
							<Icon name={IconsStrings.remove} size={20} color={theme.colors.textMuted} />
						</TouchableOpacity>
					</View>
				))}
			</ScrollView>
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

	rowContainer: {
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

	wordContainer: {
		flexGrow: 1,
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
});
