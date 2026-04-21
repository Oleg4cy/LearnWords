const React = require('react');
const { Text } = require('react-native');

function Icon(props) {
  return React.createElement(Text, props, props.name || 'icon');
}

module.exports = Icon;
