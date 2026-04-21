import React from 'react';
import { StackNavigationProp } from '@react-navigation/stack';
import { CenteredContent } from '../../modules/CenteredContent';
import { Button } from '../../components/Button';

interface IHomeScreenProps {
	navigation: StackNavigationProp<any>,
}

export const Home = ({ navigation }: IHomeScreenProps ): JSX.Element => {
  // navigation.push('Home');
	return (
		<CenteredContent navigation={navigation}>
			<Button
				title='Добавить'
				onPress={() => navigation.push(
					'WordEdit',
					{
						isNewWord: true,
					}
				)}
			/>
			<Button title='Группы слов' onPress={() => navigation.push('WordsGroups')} />
			<Button title='Тренировка' onPress={() => navigation.push('Training')} />
			{/* <Button
				title='Все слова'
				onPress={() => navigation.push('WordsList')}
			/> */}
		</CenteredContent>
	);
};

// import React from 'react';
// import { NavigationProp } from '@react-navigation/native';
// import { observer } from 'mobx-react-lite';
//
// import { CenteredContent } from '../../modules/CenteredContent';
// import { Button } from '../../components/Button';
//
// interface IHomeScreenProps {
// 	navigation: NavigationProp<any>,
// }
//
// export const Home = observer(({ navigation }: IHomeScreenProps): JSX.Element => {
// 	return (
// 		<CenteredContent navigation={navigation}>
// 			<Button title='Тренировка' onPress={() => navigation.navigate('Training')} />
// 			<Button title='Словарь' onPress={() => navigation.navigate('Dictionary')} />
// 		</CenteredContent>
// 	);
// })


