import React, {useEffect, useState} from 'react';
import {StackNavigationProp} from '@react-navigation/stack';
import {Header} from '../../modules/Header';
import {Button} from '../../components/Button';
import SWords from '../../storage/words/words.service';
import {TGroup} from '../../storage/words/words.types';

import containerStyles from '../../styles/container';
import theme from '../../styles/theme';

import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface ITrainingScreenProps {
  navigation: StackNavigationProp<any>;
}

type TTrainingGroup = {
  id: number;
  name: string;
  count: number;
};

export function Training({navigation}: ITrainingScreenProps): JSX.Element {
  const [groups, setGroups] = useState<TTrainingGroup[]>([]);
  const [selectedGroupID, setSelectedGroupID] = useState<number>(0);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const [groupsList, dictionaryCount] = await Promise.all([
        SWords.getGroups(),
        SWords.getDictionaryCount(),
      ]);
      const data: TTrainingGroup[] = [
        {id: 0, name: 'Все слова', count: dictionaryCount},
        ...groupsList
          .filter((group: TGroup) => group.id !== undefined)
          .map((group: TGroup) => ({
            id: group.id ?? 0,
            name: group.name,
            count: group.count ?? 0,
          })),
      ];
      setGroups(data);
    } catch (error) {
      console.log(error);
    }
  };

  const selectedGroup = groups.find(group => group.id === selectedGroupID);
  const trainingDisabled = !selectedGroup || selectedGroup.count < 1;

  const openTrainingMode = (screen: 'TestMode' | 'InputMode') => {
    if (!selectedGroup) {
      return;
    }
    navigation.push(screen, {
      groupID: selectedGroup.id,
      groupName: selectedGroup.name,
    });
  };

  const renderGroup = (group: TTrainingGroup) => {
    const isSelected = group.id === selectedGroupID;
    return (
      <TouchableOpacity
        key={`training-group-${group.id}`}
        style={[styles.groupRow, isSelected && styles.groupRowSelected]}
        onPress={() => setSelectedGroupID(group.id)}>
        <View style={styles.groupTextBlock}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupCount}>Слов: {group.count}</Text>
        </View>
        <View
          style={[
            styles.groupIndicator,
            isSelected && styles.groupIndicatorSelected,
          ]}>
          {isSelected && <Text style={styles.groupIndicatorText}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header backPath={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.scrollViewContent, containerStyles]}>
        <Text style={styles.title}>Группа для тренировки</Text>
        <View style={styles.groupsList}>
          {groups.map((group: TTrainingGroup) => renderGroup(group))}
        </View>
      </ScrollView>
      <View style={[styles.actions, containerStyles]}>
        <Button
          title="Режим теста"
          disabled={trainingDisabled}
          onPress={() => openTrainingMode('TestMode')}
        />
        <Button
          title="Режим ввода"
          disabled={trainingDisabled}
          onPress={() => openTrainingMode('InputMode')}
        />
      </View>
    </SafeAreaView>
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
    paddingBottom: 118,
  },

  title: {
    marginBottom: 14,
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },

  groupsList: {
    width: '100%',
  },

  groupRow: {
    width: '100%',
    minHeight: 64,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadow,
  },

  groupRowSelected: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },

  groupTextBlock: {
    flex: 1,
    paddingRight: 12,
  },

  groupName: {
    marginBottom: 4,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },

  groupCount: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },

  groupIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  groupIndicatorSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },

  groupIndicatorText: {
    color: theme.colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },

  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingBottom: 18,
    rowGap: 10,
    backgroundColor: theme.colors.appBackground,
  },
});
