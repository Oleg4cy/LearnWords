import React, { useState, useRef, useEffect, } from 'react';
import { RouteProp, useRoute, useFocusEffect, } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Header } from '../../modules/Header';
import { Alert, TAlertButton } from '../../modules/Alert';
import SWords from '../../storage/words/words.service';
import { TContext, TGroup, TTranslate, TWord } from '../../storage/words/words.types';
import Icon from 'react-native-vector-icons/FontAwesome';
import IconsStrings from '../../assets/awesomeIcons';
import SelectDropdown from 'react-native-select-dropdown';
import { BottomModalWindow } from '../../modules/BottomModalWindow';
import { GroupForm } from '../../modules/GroupForm';
import { getStatusBarHeight } from 'react-native-iphone-x-helper';

import containerStyles from '../../styles/container';
import buttonBottomFreeze, { buttonBottomFreezeText } from '../../styles/buttonBottomFreeze';
import theme from '../../styles/theme';

import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
  Platform,
} from 'react-native';

interface IWordEditScreenProps {
  navigation: StackNavigationProp<any>;
}

type RootStackParamList = {
  WordEdit: {
    isNewWord?: boolean;
    wordID?: number | null;
    groupID?: number | null;
  };
};

type TGroupOption = {
  id: number | null;
  name: string;
};

export function WordEdit({ navigation }: IWordEditScreenProps): JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'WordEdit'>>();
  const isNewWord = route.params?.isNewWord ?? false;
  const wordID = route.params?.wordID ?? null;
  const routeGroupID = route.params?.groupID ?? null;

  const inputDataGroup: TTranslate = {
    value: '',
    context: [],
    new: true,
  };

  const [isGroupListVisible, setGroupListVisible] = useState(false);
  const [isGroupFormVisible, setGroupFormVisible] = useState(false);
  const [groups, setGroups] = useState<TGroup[]>([]);
  const [selectedGroupID, setSelectedGroupID] = useState<number | null>(
    routeGroupID && routeGroupID > 0 ? routeGroupID : null,
  );
  const [start, setStart] = useState(true);
  const [isAlertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isSaveWordError, setSaveWordError] = useState(false);
  const [inputWord, setInputWord] = useState('');
  const [inputsGroups, setInputsGroup] = useState<TTranslate[]>([inputDataGroup,]);
  const [startScroll, setStartScroll] = useState(true);
  const [scrollBottom, setScrollBottom] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  useEffect(() => {
    if (scrollBottom && scrollViewRef && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
      setScrollBottom(false);
    }
  }, [scrollBottom]);

  useEffect(() => {
    fetchGroups();
  }, []);

  useFocusEffect(() => {
    if (start) {
      fetchWord();
      setStart(false);
    }
  });

  const fetchWord = async () => {
    if (!wordID) return;
    const word = await SWords.getByID(wordID);
    if (word) {
      setInputWord(word.word);
      setInputsGroup(word.translate);
      const wordGroups = await SWords.getGroups(wordID);
      setSelectedGroupID(wordGroups[0]?.id ?? null);
    }
  };

  const fetchGroups = async () => {
    try {
      const fetchedGroups = await SWords.getGroups();
      setGroups(fetchedGroups);
    } catch (error) {
      console.log(error);
    }
  };

  const groupOptions = (): TGroupOption[] => [
    { id: null, name: 'Без группы' },
    ...groups
      .filter((group: TGroup) => group.id !== undefined)
      .map((group: TGroup) => ({
        id: group.id ?? null,
        name: group.name,
      })),
  ];

  const selectedGroupName = (): string => {
    if (!selectedGroupID) return 'Без группы';
    return groups.find((group: TGroup) => group.id === selectedGroupID)?.name ?? 'Без группы';
  };

  const handleGroupCreated = async (createdGroupID?: number | null) => {
    await fetchGroups();
    if (createdGroupID) {
      setSelectedGroupID(createdGroupID);
    }
  };

  const updateTranslateValue = (value: string, index: number) => {
    setInputsGroup(prev => {
      const next = [...prev];
      if (next[index]) next[index].value = value;
      return next;
    });
  };

  const updateContextValue = (text: string, index: number, contextIndex: number) => {
    setInputsGroup(prev => {
      const next = [...prev];
      const ctx = next[index]?.context;
      if (ctx && ctx[contextIndex]) ctx[contextIndex].value = text;
      return next;
    });
  };

  const updateContextExample = (text: string, index: number, contextIndex: number) => {
    setInputsGroup(prev => {
      const next = [...prev];
      const ctx = next[index]?.context;
      if (ctx && ctx[contextIndex]) ctx[contextIndex].example = text;
      return next;
    });
  };

  const addNewContext = (index: number) => {
    const newInputsGroups = [...inputsGroups];
    const inputGroup = newInputsGroups[index];
    if (inputGroup) {
      if (!inputGroup.context) inputGroup.context = [];
      (inputGroup.context as TContext[]).push({ value: '' });
      setInputsGroup(newInputsGroups);
    }
  };

  const removeContext = (index: number, contextIndex: number) => {
    const newInputsGroups = [...inputsGroups];
    const inputGroup = newInputsGroups[index];
    if (inputGroup?.context) {
      inputGroup.context.splice(contextIndex, 1);
      setInputsGroup(newInputsGroups);
    }
  };

  const addNewTranslate = () => {
    const newInputsGroups = [...inputsGroups];
    newInputsGroups.push(inputDataGroup);
    setInputsGroup(newInputsGroups);
  };

  const removeTranslate = (index: number) => {
    const newInputsGroups = [...inputsGroups];
    if (newInputsGroups[index]) {
      newInputsGroups[index].removed = true;
    }
    setInputsGroup(newInputsGroups);
  };

  const handleLayout = () => {
    if (!startScroll) {
      setScrollBottom(true);
    }
  };

  const updateWord = async (word: TWord) => {
    word.id = wordID ?? undefined;
    await SWords.update(word);
  };

  const validationWord = (): boolean => {
    if (!inputWord) {
      setSaveWordError(true);
      setAlertMessage('Введите слово');
      setAlertVisible(true);
      return true;
    }
    if (!inputsGroups[0].value) {
      setSaveWordError(true);
      setAlertMessage('Введите перевод');
      setAlertVisible(true);
      return true;
    }

    return false;
  };

  const filterInputsGroups = () => {
    const filteredInputsGroups: TTranslate[] = inputsGroups.reduce(
      (acc: TTranslate[], item: TTranslate) => {
        if (item.value == '') {
          return acc;
        }
        if (item.context) {
          item.context = (item.context as TContext[]).filter(ctx => ctx.value !== '');
        }
        acc.push(item);
        return acc;
      },
      [],
    );
    setInputsGroup(filteredInputsGroups);
    return filteredInputsGroups;
  };

  const dbSaveWord = async (word: TWord) => {
    return new Promise(async (resolve, reject) => {
      let result = null;
      if (isNewWord) {
        result = await SWords.save(word);
      } else {
        result = await updateWord(word);
      }

      resolve(result);
    });
  };

  const saveWord = async () => {
    if (validationWord()) {
      return;
    }
    const inputsData = filterInputsGroups();

    const word: TWord = {
      word: inputWord,
      translate: inputsData,
      groups: selectedGroupID ? [selectedGroupID] : [],
    };

    setSaveWordError(false);
    setAlertMessage('Слово сохранено');
    try {
      const result = await dbSaveWord(word);
      if (result === 'duplicate') {
        setAlertMessage('Слово уже есть в словаре');
      }
      setAlertVisible(true);
    } catch (error: any) {
      console.log(error);
      setAlertMessage('При сохранении слова произошла ошибка');
      return setAlertVisible(true);
    }
  };

  const resetForm = () => {
    setInputsGroup([inputDataGroup]);
    setInputWord('');
  };

  const closeAlert = () => {
    setAlertVisible(false);
    setStart(true);
  };

  const getAlertButtons = (): TAlertButton[] => {
    const buttons: TAlertButton[] = [{
      title: 'Закрыть',
      onPress: () => {
        closeAlert();
      },
    }];

    if (isSaveWordError) return buttons;

    if (isNewWord) {
      buttons.push({
        title: 'Добавить новое слово',
        onPress: () => {
          closeAlert();
          resetForm();
          navigation.push('WordEdit', {
            isNewWord: true,
            groupID: selectedGroupID,
          });
        },
      });
    }
    buttons.push({
      title: 'Назад',
      onPress: () => {
        closeAlert();
        navigation.goBack();
      },
    });

    buttons.push({
      title: 'К списку слов',
      onPress: () => {
        closeAlert();
        navigation.push('WordsList', {
          groupID: selectedGroupID ?? null,
          listMode: selectedGroupID ? 'group' : 'withoutGroup',
          refreshKey: Date.now(),
        });
      },
    });

    return buttons;
  };

  const inputGroupTemplate = (index: number, data: TTranslate): JSX.Element => {
    return (
      <React.Fragment key={`group-${index}`}>
        <View style={styles.groupInputs}>
          <Input
            style={[styles.mb]}
            key={`translate-${index}`}
            label="Перевод"
            placeholder="Введите перевод"
            value={data.value}
            onChangeText={translate => updateTranslateValue(translate, index)}
            onLayout={() => handleLayout()}
            icon={
              inputsGroups.length > 1
                ? {
                    type: IconsStrings.remove,
                    style: { position: 'absolute', right: -2, padding: 10 },
                    onPress: () => removeTranslate(index),
                  }
                : undefined
            }
          />

          {(data.context as TContext[] | undefined)?.map(
            (ctx: TContext, contextIndex: number, arr) => {
              const isLast = contextIndex === arr.length - 1;

              return (
                <React.Fragment key={`context-${index}-${contextIndex}`}>
                  <Input
                    style={[styles.mb]}
                    label="Контекст"
                    placeholder="Добавьте контекст"
                    value={ctx.value}
                    onChangeText={text => updateContextValue(text, index, contextIndex)}
                    multiline
                    icon={{
                      type: IconsStrings.cancel,
                      style: { position: 'absolute', right: -2, padding: 10 },
                      onPress: () => removeContext(index, contextIndex),
                    }}
                  />

                  <Input
                    style={[styles.mb]}
                    label="Пример использования"
                    placeholder="Добавьте пример"
                    value={ctx.example || ''}
                    onChangeText={text => updateContextExample(text, index, contextIndex)}
                    multiline
                  />

                  {!isLast && <View style={styles.divider} />}
                </React.Fragment>
              );
            },
          )}

          <Button
            style={styles.inlineActionButton}
            textStyle={styles.inlineActionButtonText}
            icon={{
              front: true,
              type: IconsStrings.plus,
              color: theme.colors.primary,
              style: styles.inlineActionIcon,
            }}
            title="Добавить контекст"
            onPress={() => addNewContext(index)}
          />
        </View>
      </React.Fragment>
    );
  };

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
        <Header
          backPath={() => {
            setStart(true);
            navigation.goBack();
          }}
          accept={() => saveWord()}
        />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? getStatusBarHeight(true) : 0}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={[styles.scrollViewContent, containerStyles]}>
            <View style={styles.section}>
              <Button
                style={[styles.inlineActionButton, styles.groupActionButton]}
                textStyle={styles.inlineActionButtonText}
                title={`Группа: ${selectedGroupName()}`}
                onPress={() => setGroupListVisible(true)}
              />
              <Input
                style={[styles.mb]}
                label="Слово"
                placeholder="Введите слово"
                value={inputWord}
                onChangeText={word => setInputWord(word)}
              />
              {inputsGroups.map((data, index) =>
                data.removed ? null : inputGroupTemplate(index, data),
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <Button
          style={buttonBottomFreeze}
          textStyle={buttonBottomFreezeText}
          title="Добавить перевод"
          onPress={() => {
            setStartScroll(false);
            addNewTranslate();
          }}
        />
      </SafeAreaView>
      <BottomModalWindow
        isVisible={isGroupListVisible}
        onOverlayPress={() => setGroupListVisible(false)}>
        <Text style={styles.modalTitle}>Группа слова</Text>
        <SelectDropdown
          data={groupOptions()}
          onSelect={(selectedItem: TGroupOption) => {
            setSelectedGroupID(selectedItem.id);
            setGroupListVisible(false);
          }}
          rowTextForSelection={(item: TGroupOption) => {
            return item.name;
          }}
          defaultButtonText={selectedGroupName()}
          buttonTextAfterSelection={(selectedItem: TGroupOption) => {
            return selectedItem.name;
          }}
          buttonStyle={styles.dropdown1BtnStyle}
          buttonTextStyle={styles.dropdown1BtnTxtStyle}
          renderDropdownIcon={isOpened => {
            return (
              <Icon
                name={isOpened ? 'chevron-up' : 'chevron-down'}
                color={'#444'}
                size={18}
              />
            );
          }}
          dropdownIconPosition={'right'}
          dropdownStyle={styles.dropdown1DropdownStyle}
          rowStyle={styles.dropdown1RowStyle}
          rowTextStyle={styles.dropdown1RowTxtStyle}
        />
        <Button
          style={styles.addGroupButton}
          title="Добавить группу"
          onPress={() => setGroupFormVisible(true)}
        />
      </BottomModalWindow>
      <GroupForm
        navigation={navigation}
        onClose={() => setGroupFormVisible(false)}
        isVisible={isGroupFormVisible}
        onCreate={handleGroupCreated}
        showAddWordsButton={false}
      />
      <Alert
        isVisible={isAlertVisible}
        message={alertMessage}
        buttons={getAlertButtons()}
        onOverlayPress={() => setAlertVisible(!isAlertVisible)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  mb: {
    marginBottom: 12,
  },

  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.appBackground,
  },

  flex: {
    flex: 1,
  },

  scrollViewContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 84,
  },

  wordRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  section: {
    width: '100%',
    paddingBottom: 30,
  },

  groupInputs: {
    marginBottom: 16,
    padding: 14,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    ...theme.shadow,
  },

  inlineActionButton: {
    minHeight: 38,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },

  inlineActionButtonText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },

  inlineActionIcon: {
    color: theme.colors.primary,
    marginRight: 8,
  },

  groupActionButton: {
    marginBottom: 16,
  },

  contextRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },

  removeContextIcon: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    marginLeft: 10,
  },

  groupForm: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    paddingTop: 30,
    paddingBottom: 50,
    backgroundColor: theme.colors.surface,
    zIndex: 100,
  },

  modalTitle: {
    marginBottom: 12,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },

  addGroupButton: {
    marginTop: 14,
    backgroundColor: theme.colors.primary,
  },

  dropdown1BtnStyle: {
    width: '100%',
    height: 48,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dropdown1BtnTxtStyle: { color: theme.colors.text, textAlign: 'left', fontSize: 15 },
  dropdown1DropdownStyle: { backgroundColor: theme.colors.surface },
  dropdown1RowStyle: { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
  dropdown1RowTxtStyle: { color: theme.colors.text, textAlign: 'left', fontSize: 15 },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
});

