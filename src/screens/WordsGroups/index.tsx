import React, { useState, useEffect, useRef } from 'react';
import { NavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Header } from '../../modules/Header';
import { GroupForm } from '../../modules/GroupForm';
import SWords from '../../storage/words/words.service';
import { TGroup } from '../../storage/words/words.types';
import IconsStrings from '../../assets/awesomeIcons';

import containerStyles from '../../styles/container';
import theme from '../../styles/theme';

import {
	SafeAreaView,
	StyleSheet,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';

interface IWordsGroupsScreenProps {
	navigation: StackNavigationProp<any>,
}

export function WordsGroups({ navigation }: IWordsGroupsScreenProps): JSX.Element {
  const [groups, setGroups] = useState<TGroup[]>([]);
	const [dictionaryCount, setDictionaryCount] = useState<number>(0);
	const [withoutGroupsCount, setWithoutGroupsCount] = useState<number>(0);
	const [isGroupFormVisible, setGroupFormVisible] = useState<boolean>(false);

	const [switchData, activateSwitchData] = useState<boolean>(false);

  const getGroups = async () => {
    const allArr: TGroup[] = await SWords.getGroups();
    console.log(allArr);
		setGroups(allArr);
	}

	const getAllCount = async () => {
		const count: number = await SWords.getDictionaryCount();
		setDictionaryCount(count);
	}

	const getWordsWithoutGroups = async () => {
		const count: number = await SWords.getWithoutGroupsCount();
		setWithoutGroupsCount(count);
	}

	useEffect(() => {
		getData();
	}, [switchData]);

	const getData = async () => {
		try {
			await getGroups();
			await getAllCount();
			await getWordsWithoutGroups();
		} catch (error: any) {
			console.log(error);
		}
	}


	const rowTemplate = (name: string, count: number, id?: number) => {
		return (
			<TouchableOpacity
				key={`group-${id ?? 'no-group'}`}
				style={[styles.rowContainer]}
				onPress={() => navigation.push(
					'WordsList',
					{
						groupID: id ?? null,
					}
				)}
			>
				<View>
					<Text style={styles.rowTitle}>{name}</Text>
					<Text style={styles.rowSubtitle}>Слов: {count}</Text>
				</View>
				<Text style={styles.rowCount}>{count}</Text>
			</TouchableOpacity>
		);
	}

	return (
		<>
			<SafeAreaView style={styles.container}>
				<Header
					backPath={() => navigation.goBack()}
					rightIcon={{
						type: IconsStrings.plus,
						onPress: () => setGroupFormVisible(true),
					}}
				/>
				<ScrollView contentContainerStyle={[styles.scrollViewContent, containerStyles]}>
					{groups.map((group: TGroup) => rowTemplate(group.name, group.count ?? 0, group.id))}
					{rowTemplate('Все слова', dictionaryCount, 0)}
					{rowTemplate('Слова без групп', withoutGroupsCount)}
				</ScrollView>
			</SafeAreaView >
			<GroupForm
				navigation={navigation as NavigationProp<any>}
				onClose={() => setGroupFormVisible(false)}
				isVisible={isGroupFormVisible}
				onCreate={() => activateSwitchData(!switchData)}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: theme.colors.appBackground,
	},

	scrollViewContent: {
		flexGrow: 1,
		paddingTop: 10,
		paddingBottom: 24,
	},

	rowContainer: {
		marginBottom: 8,
		minHeight: 64,
		paddingVertical: 12,
		paddingHorizontal: 14,
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

	rowTitle: {
		color: theme.colors.text,
		fontSize: 16,
		fontWeight: '600',
	},

	rowSubtitle: {
		marginTop: 3,
		color: theme.colors.textMuted,
		fontSize: 12,
	},

	rowCount: {
		minWidth: 34,
		paddingHorizontal: 9,
		paddingVertical: 5,
		overflow: 'hidden',
		borderRadius: theme.radius.xs,
		backgroundColor: theme.colors.primarySoft,
		color: theme.colors.primary,
		fontSize: 13,
		fontWeight: '700',
		textAlign: 'center',
	},
});

