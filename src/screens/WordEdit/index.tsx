import React, { useState, useRef, useEffect, } from 'react';
import { RouteProp, useRoute, useFocusEffect, } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Header } from '../../modules/Header';
import { Alert, TAlertButton } from '../../modules/Alert';
import SWords from '../../storage/words/words.service';
import { TTranslate, TWord } from '../../storage/words/words.types';
import Icon from 'react-native-vector-icons/FontAwesome';
import IconsStrings from '../../assets/awesomeIcons';
import SelectDropdown from 'react-native-select-dropdown';
import { BottomModalWindow } from '../../modules/BottomModalWindow';
import { getStatusBarHeight } from 'react-native-iphone-x-helper';

import containerStyles from '../../styles/container';
import buttonBottomFreeze, { buttonBottomFreezeText } from '../../styles/buttonBottomFreeze';
import theme from '../../styles/theme';

import {
  SafeAreaView,
  View,
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

export function WordEdit({ navigation }: IWordEditScreenProps): JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'WordEdit'>>();
  const isNewWord = route.params?.isNewWord ?? false;
  const wordID = route.params?.wordID ?? null;
  const groupID = route.params?.groupID ?? null;

  const inputDataGroup: TTranslate = {
    value: '',
    context: [],
    new: true,
  };

  const [isGroupListVisible, setGroupListVisible] = useState(false);
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
    }
  };

  const updateInputGroups = (
    value: string,
    index: number,
    type: string,
    contextIndex?: number,
  ) => {
    setInputsGroup(prevInputGroups => {
      const newInputsGroups = [...prevInputGroups];
      const inputGroup = newInputsGroups[index];
      if (!inputGroup) return newInputsGroups;
      switch (type) {
        case 'translate':
          inputGroup.value = value;
          break;
        case 'context':
          if (inputGroup.context && contextIndex !== undefined) {
            inputGroup.context[contextIndex] = value;
          }
          break;
      }
      return newInputsGroups;
    });
  };

  const addNewContext = (index: number) => {
    const newInputsGroups = [...inputsGroups];
    const inputGroup = newInputsGroups[index];
    if (inputGroup?.context) {
      inputGroup.context.push('');
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
          item.context = item.context.filter(contextItem => contextItem !== '');
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

  const getAlertButtons = (): TAlertButton[] => {
    const buttons: TAlertButton[] = [{
      title: 'Закрыть',
      onPress: () => {
        setAlertVisible(!isAlertVisible);
        setStart(true);
      },
    }];

    if (isSaveWordError) return buttons;

    if (isNewWord) {
      buttons.push({
        title: 'Добавить новое слово',
        onPress: () => {
          setAlertVisible(!isAlertVisible);
          resetForm();
          setStart(true);
          navigation.push('WordEdit', {
            isNewWord: true,
          });
        },
      });
    }
    buttons.push({
      title: 'Назад',
      onPress: () => {
        setAlertVisible(!isAlertVisible);
        setStart(true);
        navigation.goBack();
      },
    });

    buttons.push({
      title: 'К списку слов',
      onPress: () => {
        setAlertVisible(!isAlertVisible);
        setStart(true);
        navigation.navigate('WordsList', { groupID: groupID});
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
            onChangeText={translate =>
              updateInputGroups(translate, index, 'translate')
            }
            onLayout={() => handleLayout()}
            icon={
              inputsGroups.length > 1
                ? {
                  type: IconsStrings.remove,
                  style: {
                    position: 'absolute',
                    right: -2,
                    padding: 10,
                  },
                  onPress: () => removeTranslate(index),
                }
                : undefined
            }
          />

          {data.context &&
            data.context.map((contextValue: string, contextIndex: number) => {
              return (
                <Input
                  style={[styles.mb]}
                  key={`context-${index}-${contextIndex}`}
                  label="Контекст"
                  placeholder="Добавьте контекст"
                  value={contextValue}
                  onChangeText={context =>
                    updateInputGroups(context, index, 'context', contextIndex)
                  }
                  multiline={true}
                  icon={{
                    type: IconsStrings.cancel,
                    style: {
                      position: 'absolute',
                      right: -2,
                      padding: 10,
                    },
                    onPress: () => removeContext(index, contextIndex),
                  }}
                />
              )
            })}
          <Button
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
                style={styles.topActionButton}
                title="Показать список групп"
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
        <SelectDropdown
          data={['Egypt', 'Canada', 'Australia', 'Ireland']}
          onSelect={(selectedItem, index) => {
            console.log(selectedItem, index);
          }}
          rowTextForSelection={(item, index) => {
            // text represented for each item in dropdown
            // if data array is an array of objects then return item.property to represent item in dropdown
            return item;
          }}
          defaultButtonText={'Select country'}
          buttonTextAfterSelection={(selectedItem, index) => {
            return selectedItem;
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
      </BottomModalWindow>
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

  topActionButton: {
    marginBottom: 16,
    backgroundColor: theme.colors.text,
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
});
