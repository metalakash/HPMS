import React from 'react';
import { View, StyleSheet } from 'react-native';

interface FileIconProps {
  fileType: string;
  size?: 'small' | 'medium' | 'large';
}

export const FileIcon = ({ fileType, size = 'medium' }: FileIconProps) => {
  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'xls':
      case 'xlsx':
        return '📊';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return '🖼️';
      case 'zip':
        return '📦';
      default:
        return '📋';
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.small;
      case 'large':
        return styles.large;
      default:
        return styles.medium;
    }
  };

  return (
    <View style={[styles.container, getSizeStyle()]}>
      {getIcon(fileType)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  small: {
    width: 24,
    height: 24,
    fontSize: 12,
  },
  medium: {
    width: 40,
    height: 40,
    fontSize: 20,
  },
  large: {
    width: 60,
    height: 60,
    fontSize: 32,
  },
});
