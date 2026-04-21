import React, { useState, useRef, useEffect } from 'react';
import { RouteProp, useRoute, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Header } from '../../modules/Header';
import { Alert, TAlertButton } from '../../modules/Alert';
import SWords from '../../storage/words/words.service';
import { TTranslate, TWord } from '../../storage/words/words.types';
import IconsStrings from '../../assets/awesomeIcons';
import shuffle from '../../helpers/shuffleArray';

import containerStyles from '../../styles/container';
import buttonBottomFreeze, { buttonBottomFreezeText } from '../../styles/buttonBottomFreeze';

import {
  SafeAreaView,
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import theme from '../../styles/theme';

interface IInputModeScreenProps {
  navigation: StackNavigationProp<any>;
}

type RootStackParamList = {
  InputMode: {
    groupID?: number,
    groupName?: string,
  },
};

type TAnswer = {
  correct: boolean,
  value: string,
}

type TMode = 'word' | 'translate';

export function InputMode({ navigation }: IInputModeScreenProps): JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'InputMode'>>();
  const groupID = route.params?.groupID ?? 0;

  const emptyAnswer: TAnswer = { correct: false, value: '' };

  const modes: TMode[] = ['word', 'translate'];
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [activeMode, setActiveMode] = useState<TMode>(modes[0]);
  const [isRandomMode, setRandomMode] = useState<boolean>(false);
  const [isAlertVisible, setAlertVisible] = useState(false);
  const [activeWord, setActiveWord] = useState<TWord | null>(null);
  const [activeTranslate, setActiveTranslate] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [checkButtonDisabled, setCheckButtonDisabled] = useState(true);
  const [inputsGroups, setInputsGroups] = useState<TAnswer[]>([emptyAnswer]);
  const [scrollBottom, setScrollBottom] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (scrollBottom && scrollViewRef && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
      setScrollBottom(false);
    }
  }, [scrollBottom]);


  useEffect(() => {
    fetchWord();
  }, []);

  useEffect(() => {
    if (isRandomMode) {
      const shuffledModes = shuffle(modes);
      setActiveMode(shuffledModes[0]);
    }
  }, [activeWord])

  useEffect(() => {
  }, [inputsGroups]);

  const fetchWord = async () => {
    const word = await SWords.getRandom(groupID);
    if (word) {
      setActiveWord(word);
      const ind = Math.floor(Math.random() * (word.translate.length - 1));
      const shuffledTranslates = shuffle(word.translate);
      const value = shuffledTranslates[ind].value;
      setActiveTranslate(value);
    };
  }

  const updateAnswer = (value: string, index: number) => {
    setInputsGroups(prevInputGroups => {
      const newInputsGroups = [...prevInputGroups];
      newInputsGroups[index].value = value;
      const checkAnswer = newInputsGroups.filter(answer => answer.value > '');
      if (checkAnswer.length > 0) setCheckButtonDisabled(false);
      else setCheckButtonDisabled(true);
      return newInputsGroups;
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

  const addNewTranslate = () => {
    setInputsGroups((prevInputGroups: TAnswer[]) => {
      const newInputsGroups = [...prevInputGroups, emptyAnswer];
      return newInputsGroups;
    });
  }

  const handleLayout = () => {
    setScrollBottom(true);
  }

  const reset = () => {
    setInputsGroups([emptyAnswer]);
    setCheckButtonDisabled(true);
    setActiveWord(null);
    setChecked(false);
    setShowCorrectAnswer(false);
  }

  const next = () => {
    reset();
    fetchWord();
    // if (isRandomMode) {
    //   const shuffledModes = shuffle(modes);
    //   setActiveMode(shuffledModes[0]);
    // }
  }

  const check = () => {
    setChecked(true);

    setInputsGroups(prevInputGroups => {
      let newInputsGroups = [...prevInputGroups];
      newInputsGroups = newInputsGroups.filter(answer => answer.value.trim() !== '');

      if (newInputsGroups.length < 1) {
        newInputsGroups = [{ correct: false, value: '' }];
      }

      let hasWrongAnswer = false;

      newInputsGroups = newInputsGroups.map((answer: TAnswer) => {
        if (!activeWord) return answer;

        let checkAnswer = false;

        switch (activeMode) {
          case 'word':
            checkAnswer = activeWord.word.toLowerCase().trim() === answer.value.toLowerCase().trim();
            break;

          case 'translate':
            checkAnswer = activeWord.translate.some(translate =>
              translate.value.toLowerCase().trim() === answer.value.toLowerCase().trim()
            );
            break;
        }

        if (!checkAnswer) {
          hasWrongAnswer = true;
        }

        return {
          ...answer,
          correct: checkAnswer,
        };
      });

      setShowCorrectAnswer(hasWrongAnswer);

      return newInputsGroups;
    });
  };

  const isModeTabActive = (mode: TMode) => activeMode === mode && !isRandomMode;

  const renderModeTab = (mode: TMode) => {
    const isActive = isModeTabActive(mode);
    return (
      <TouchableOpacity
        key={`mode_${mode}`}
        style={[styles.modeTab, isActive ? styles.modeTabActive : styles.modeTabInactive]}
        onPress={() => changeMode(mode)}
        disabled={isActive}
      >
        <View style={[styles.modeIndicator, isActive ? styles.modeIndicatorActive : styles.modeIndicatorInactive]}>
          {isActive && <Icon name={IconsStrings.accept} size={10} color={theme.colors.surface} />}
        </View>
        <Text style={[styles.modeTabText, isActive ? styles.modeTabTextActive : styles.modeTabTextInactive]}>
          {mode}
        </Text>
      </TouchableOpacity>
    );
  }

  const renderRandomTab = () => {
    return (
      <TouchableOpacity
        style={[styles.modeTab, isRandomMode ? styles.modeTabActive : styles.modeTabInactive]}
        onPress={() => changeModeToRandom()}
        disabled={isRandomMode}
      >
        <View style={[styles.modeIndicator, isRandomMode ? styles.modeIndicatorActive : styles.modeIndicatorInactive]}>
          {isRandomMode && <Icon name={IconsStrings.accept} size={10} color={theme.colors.surface} />}
        </View>
        <Text style={[styles.modeTabText, isRandomMode ? styles.modeTabTextActive : styles.modeTabTextInactive]}>
          random
        </Text>
      </TouchableOpacity>
    );
  }

  const changeMode = (mode: TMode) => {
    setRandomMode(false);
    setActiveMode(mode);
    next();
  }

  const changeModeToRandom = () => {
    setRandomMode(true);
    next();
  }

  const getTitle = (): string => {
    switch (activeMode) {
      case 'word':
          return activeTranslate ?? '';
      case 'translate':
          return activeWord?.word ?? '';
    }
  }

  const getInputStatusStyle = (answer: TAnswer) => {
    if (!checked) return undefined;
    return {
      borderColor: answer.correct ? theme.colors.success : theme.colors.danger,
      backgroundColor: answer.correct ? theme.colors.successSoft : theme.colors.dangerSoft,
    };
  };

  const removeTranslateInput = (index: number): void => {
    let newInputsGroups: TAnswer[] = [... inputsGroups];
    newInputsGroups.splice(index, 1);
    setInputsGroups(newInputsGroups);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header backPath={() => setAlertVisible(true)} />
      <KeyboardAvoidingView
        style={[styles.flex]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView ref={scrollViewRef} contentContainerStyle={[styles.scrollViewContent, containerStyles]}>
          <View style={styles.section}>
            <View style={styles.modes}>
              {modes.map((mode: TMode) => renderModeTab(mode))}
              {renderRandomTab()}
            </View>
            <Text style={styles.word}>{getTitle()}</Text>
            {inputsGroups.map((answer: TAnswer, index) => (
              <Input
                key={`translate-${index}`}
                style={styles.answerInput}
                placeholder="Введите перевод"
                value={answer.value}
                onChangeText={(value: string) => updateAnswer(value, index)}
                onLayout={() => handleLayout()}
                disabled={checked}
                focusedStyle={getInputStatusStyle(answer)}
                icon={inputsGroups.length > 1 ? {
                  type: IconsStrings.remove,
                  style: {
                    position: 'absolute',
                    right: '-12%',
                    padding: 10,
                  },
                  onPress: () => removeTranslateInput(index),
                } : undefined}
              />
            ))}
            {checked && showCorrectAnswer && activeWord && (
              <View style={styles.correctAnswerBox}>
                <Text style={styles.correctAnswerTitle}>Правильный ответ</Text>

                {activeWord.translate.map((translate, translateIndex, translateArr) => (
                  <React.Fragment key={`correct-translate-${translateIndex}`}>
                    <View style={styles.correctTranslateBlock}>
                      <Text style={styles.correctAnswerValue}>{translate.value}</Text>

                      {(translate.context || []).map((ctx, contextIndex, contextArr) => (
                        <React.Fragment key={`correct-context-${translateIndex}-${contextIndex}`}>
                          <View style={styles.correctContextCard}>
                            <Text style={styles.correctContextLabel}>Контекст</Text>
                            <Text style={styles.correctContextValue}>{ctx.value}</Text>

                            {ctx.example ? (
                              <>
                                <Text style={styles.correctContextLabel}>Пример использования</Text>
                                <Text style={styles.correctContextValue}>{ctx.example}</Text>
                              </>
                            ) : null}
                          </View>

                          {contextIndex !== contextArr.length - 1 && (
                            <View style={styles.contextDivider} />
                          )}
                        </React.Fragment>
                      ))}
                    </View>

                    {translateIndex !== translateArr.length - 1 && (
                      <View style={styles.translateDivider} />
                    )}
                  </React.Fragment>
                ))}
              </View>
            )}
            {activeMode === 'translate' && <Button title='Добавить перевод' onPress={() => addNewTranslate()} disabled={checked} />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Button
        style={buttonBottomFreeze}
        textStyle={buttonBottomFreezeText}
        disabled={checkButtonDisabled}
        title={checked ? "Следующее слово" : "Проверить"}
        onPress={() => {
          if (checked) next();
          else check();
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
    backgroundColor: theme.colors.appBackground,
  },

  flex: {
    flex: 1,
  },

  word: {
    width: '100%',
    marginBottom: 22,
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },

  scrollViewContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 92,
  },

  section: {
    width: '100%',
    paddingBottom: 45,
  },

  modes: {
    flexDirection: 'row',
    justifyContent: 'center',
    columnGap: 8,
    marginBottom: 22,
  },

  modeTab: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 7,
  },

  modeTabActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },

  modeTabInactive: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },

  modeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modeIndicatorActive: {
    backgroundColor: theme.colors.primary,
  },

  modeIndicatorInactive: {
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
  },

  modeTabText: {
    fontSize: 14,
    fontWeight: '600',
  },

  modeTabTextActive: {
    color: theme.colors.primary,
  },

  modeTabTextInactive: {
    color: theme.colors.text,
  },

  answerInput: {
    marginBottom: 12,
  },
  correctAnswerBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  correctAnswerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
  },

  correctTranslateBlock: {
    paddingVertical: 4,
  },

  correctAnswerValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
  },

  correctContextCard: {
    paddingVertical: 6,
  },

  correctContextLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: 4,
  },

  correctContextValue: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 21,
  },

  contextDivider: {
    height: 1,
    backgroundColor: '#E9E9E9',
    marginVertical: 10,
  },

  translateDivider: {
    height: 1,
    backgroundColor: '#D5D5D5',
    marginVertical: 14,
  },
  /*
  correctContextCard: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.appBackground,
  },
  */
});
