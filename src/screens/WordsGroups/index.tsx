import React, { useState, useEffect, useRef } from 'react';
import { NavigationProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Header } from '../../modules/Header';
import { GroupForm } from '../../modules/GroupForm';
import { Alert, TAlertButton } from '../../modules/Alert';
import { Button } from '../../components/Button';
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
	const [selectedGroupIDs, setSelectedGroupIDs] = useState<number[]>([]);
	const [isDeleteAlertVisible, setDeleteAlertVisible] = useState<boolean>(false);
	const isLongPressRef = useRef<boolean>(false);

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

	useFocusEffect(
		React.useCallback(() => {
			getData();
			return () => {};
		}, [])
	);

	const getData = async () => {
		try {
			await getGroups();
			await getAllCount();
			await getWordsWithoutGroups();
		} catch (error: any) {
			console.log(error);
		}
	}

	const isSelectionMode = selectedGroupIDs.length > 0;

	const toggleGroupSelection = (id?: number) => {
		if (!id) return;
		setSelectedGroupIDs(prevSelectedIDs => {
			if (prevSelectedIDs.includes(id)) {
				return prevSelectedIDs.filter(selectedID => selectedID !== id);
			}
			return [...prevSelectedIDs, id];
		});
	}

	const openGroup = (id?: number) => {
		const listMode = id === 0
			? 'all'
			: id
				? 'group'
				: 'withoutGroup';

		navigation.push(
			'WordsList',
			{
				groupID: id ?? null,
				listMode,
			}
		);
	}

	const handleRowPress = (id?: number) => {
		if (isLongPressRef.current) {
			isLongPressRef.current = false;
			return;
		}
		if (isSelectionMode && id) {
			toggleGroupSelection(id);
			return;
		}
		if (isSelectionMode) return;
		openGroup(id);
	}

	const removeSelectedGroups = async (deleteWords: boolean) => {
		try {
			await SWords.removeGroups(selectedGroupIDs, deleteWords);
			setDeleteAlertVisible(false);
			setSelectedGroupIDs([]);
			activateSwitchData(!switchData);
		} catch (error) {
			console.log(error);
			setDeleteAlertVisible(false);
		}
	}

	const getDeleteAlertButtons = (): TAlertButton[] => [
		{
			title: 'Удалить только группу',
			onPress: () => removeSelectedGroups(false),
		},
		{
			title: 'Удалить группу и слова',
			onPress: () => removeSelectedGroups(true),
		},
		{
			title: 'Отмена',
			onPress: () => setDeleteAlertVisible(false),
		},
	];

	const rowTemplate = (name: string, count: number, id?: number) => {
		const isSelectable = Boolean(id);
		const isSelected = Boolean(id && selectedGroupIDs.includes(id));

		return (
			<TouchableOpacity
				key={`group-${id ?? 'no-group'}`}
				style={[
					styles.rowContainer,
					isSelected && styles.rowContainerSelected,
				]}
				onPress={() => handleRowPress(id)}
				onLongPress={() => {
					isLongPressRef.current = true;
					if (isSelectable) {
						toggleGroupSelection(id);
					}
				}}
			>
				<View style={styles.rowTextBlock}>
					<Text style={styles.rowTitle}>{name}</Text>
					<Text style={styles.rowSubtitle}>Слов: {count}</Text>
				</View>
				{isSelected
					? <Text style={styles.selectedMark}>✓</Text>
					: <Text style={styles.rowCount}>{count}</Text>
				}
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
				{isSelectionMode && (
					<View style={[styles.actions, containerStyles]}>
						<Button
							title={`Удалить (${selectedGroupIDs.length})`}
							style={styles.deleteButton}
							onPress={() => setDeleteAlertVisible(true)}
						/>
							<Button
								title="Отмена"
								style={styles.cancelSelectionButton}
								textStyle={styles.cancelSelectionButtonText}
								onPress={() => setSelectedGroupIDs([])}
							/>
					</View>
				)}
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
			<Alert
				isVisible={isDeleteAlertVisible}
				message="Как удалить выбранные группы?"
				buttons={getDeleteAlertButtons()}
				onOverlayPress={() => setDeleteAlertVisible(false)}
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
		width: '100%',
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

	rowTextBlock: {
		flex: 1,
		paddingRight: 12,
	},

	rowContainerSelected: {
		borderWidth: 2,
		borderColor: theme.colors.primary,
		backgroundColor: theme.colors.primarySoft,
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
