import {StyleSheet} from 'react-native';
import { ifIphoneX, getBottomSpace } from 'react-native-iphone-x-helper';
import theme from './theme';

const buttonBottomFreeze = StyleSheet.create({
  style: {
    position: 'absolute',
    left: 20,
    right: 20,
    ...ifIphoneX({ bottom: getBottomSpace() + 15, }, {bottom: 15}),
    width: undefined,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
  },
  text: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});

export const buttonBottomFreezeText = buttonBottomFreeze.text;
export default buttonBottomFreeze.style;
