import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

const SplashScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>HPMS</Text>
      <Text style={styles.subtitle}>Hydropower Project Management</Text>
      <ActivityIndicator size="large" color="#1976d2" style={styles.loader} />
      <Text style={styles.version}>Version 1.0.0</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1976d2',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  loader: {
    marginVertical: 20,
  },
  version: {
    fontSize: 12,
    color: '#999',
    marginTop: 20,
  },
});

export default SplashScreen;
