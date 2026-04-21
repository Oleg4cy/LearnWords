import React from 'react';
import { StackNavigationProp } from '@react-navigation/stack';
import { CenteredContent } from '../../modules/CenteredContent';
import { Button } from '../../components/Button';

interface IDictionaryScreenProps {
	navigation: StackNavigationProp<any>,
}

export const Dictionary = ({ navigation }: IDictionaryScreenProps): JSX.Element => {
	return (
		<CenteredContent navigation={navigation} header={true} backPath="Home">
			<Button
				title='Добавить'
				onPress={() => navigation.navigate(
					'WordData',
					{
						wordShow: false,
						wordEdit: true,
						wordNew: true,
					}
				)}
			/>
			<Button title='Группы слов' onPress={() => navigation.navigate('WordsGroups')} />
			<Button title='Все слова' onPress={() => navigation.navigate('WordList')} />
		</CenteredContent>
	);
};

