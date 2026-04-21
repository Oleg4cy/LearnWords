import React, { useState } from "react";
import { useFocusEffect, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Button } from "../../components/Button";
import { Header } from "../../modules/Header";
import SWords from "../../storage/words/words.service";
import { TTranslate, TWord } from "../../storage/words/words.types";
import IconsStrings from "../../assets/awesomeIcons";

import containerStyles from "../../styles/container";
import buttonBottomFreeze, { buttonBottomFreezeText } from "../../styles/buttonBottomFreeze";
import theme from "../../styles/theme";

import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type RootStackParamList = {
  WordData: {
    groupID?: number,
    wordID?: number,
  };

  WordEdit: {
    isNewWord: boolean;
    wordID: number | null;
    groupID: number | null;
  };

};

interface IWordDataScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'WordData', 'WordEdit'>;
}

export function WordData({ navigation }: IWordDataScreenProps): JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'WordData'>>();
  const groupID: number | null = route.params?.groupID ?? null;

  const wordDataGroup: TTranslate = {
    value: "",
    context: [],
    new: true,
  };

  const [start, setStart] = useState<boolean>(true);
  const [wordID, setWordID] = useState<number | null>(
    route.params?.wordID ?? null,
  );
  const [wordName, setWordName] = useState<string>("");
  const [wordData, setWordData] = useState<TTranslate[]>([wordDataGroup]);

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
      setWordName(word.word);
      setWordData(word.translate);
    }
  };

  const nextWord = async (order: "next" | "prev") => {
    if (!wordID || !groupID) return;
    let word = await SWords.getNextWordInGroup(wordID, groupID, order);
    if (!word) {
      const extreme = order === "next" ? "first" : "last";
      word = await SWords.getExtremeWordInGroup(groupID, extreme);
    }
    if (word) {
      setWordID(word.id ?? null);
      setWordName(word.word);
      setWordData(word.translate);
    }
  };

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
        <Header
          backPath={() => navigation.goBack()}
          rightIcon={{
            type: IconsStrings.edit,
            onPress: () => {
              setStart(true);
              navigation.push(
                "WordEdit",
                { isNewWord: false, wordID: wordID, groupID: groupID },
              );
            },
          }}
        />
        <Button
          style={styles.prevButton}
          title="Предыдущее слово"
          onPress={() => nextWord("prev")}
        />
        <ScrollView
          contentContainerStyle={[styles.scrollViewContent, containerStyles]}
        >
          <View style={styles.section}>
            <Text style={styles.wordTitle}>{wordName}</Text>
            {wordData.map((data, index) => {
              return (
                <React.Fragment key={`group-${index}`}>
                  <View style={styles.groupWord}>
                    <View key={`translate-${index}`}>
                      <Text style={styles.label}>Перевод</Text>
                      <Text style={styles.value}>{data.value}</Text>
                    </View>

                    {data.context &&
                      data.context.map(
                        (contextValue: string, contextIndex: number) => {
                          return (
                            <View key={`context-${index}-${contextIndex}`}>
                              <Text style={styles.label}>Контекст</Text>
                              <Text style={styles.contextValue}>{contextValue}</Text>
                            </View>
                          );
                        },
                      )}
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </ScrollView>
        <Button
          style={buttonBottomFreeze}
          textStyle={buttonBottomFreezeText}
          title="Следующее слово"
          onPress={() => nextWord("next")}
        />
      </SafeAreaView>
    </>
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

  scrollViewContent: {
    flexGrow: 1,
    paddingTop: 10,
    paddingBottom: 84,
  },

  section: {
    width: "100%",
    paddingBottom: 30,
  },

  groupWord: {
    marginBottom: 10,
    padding: 14,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    ...theme.shadow,
  },

  prevButton: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: theme.colors.primary,
  },

  wordTitle: {
    marginBottom: 16,
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "700",
  },

  label: {
    marginBottom: 4,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },

  value: {
    marginBottom: 14,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "600",
  },

  contextValue: {
    marginBottom: 14,
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
});
