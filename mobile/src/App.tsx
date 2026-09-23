/**
 * Hydropower Project Management System - Mobile App
 * Phase 5 Task 3: Native iOS/Android Application
 */

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { I18nextProvider } from 'react-i18next';

import i18n from './i18n';
import { useAppStore } from './store/app.store';

// Screens
import DashboardScreen from './screens/Dashboard';
import InspectionScreen from './screens/Inspection';
import MaintenanceScreen from './screens/Maintenance';
import SettingsScreen from './screens/Settings';
import ProjectDetailScreen from './screens/ProjectDetail';
import SplashScreen from './screens/Splash';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Main navigation structure with dashboard, inspection, maintenance, and settings
 */
const DashboardNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Projects',
          tabBarLabel: 'Projects',
          tabBarTestID: 'tab-dashboard',
        }}
      />
      <Tab.Screen
        name="Inspection"
        component={InspectionScreen}
        options={{
          title: 'Inspections',
          tabBarLabel: 'Inspections',
          tabBarTestID: 'tab-inspection',
        }}
      />
      <Tab.Screen
        name="Maintenance"
        component={MaintenanceScreen}
        options={{
          title: 'Maintenance',
          tabBarLabel: 'Maintenance',
          tabBarTestID: 'tab-maintenance',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarTestID: 'tab-settings',
        }}
      />
    </Tab.Navigator>
  );
};

/**
 * Root app component with authentication flow
 */
export default function App() {
  const { isInitialized, isDarkMode, isAuthenticated } = useAppStore();

  useEffect(() => {
    // Initialize app on mount
    useAppStore.getState().initialize();
  }, []);

  if (!isInitialized) {
    return <SplashScreen />;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: true,
            animationEnabled: true,
          }}
        >
          {isAuthenticated ? (
            <>
              <Stack.Screen
                name="MainApp"
                component={DashboardNavigator}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="ProjectDetail"
                component={ProjectDetailScreen}
                options={{ title: 'Project Details' }}
              />
            </>
          ) : (
            <Stack.Screen
              name="Auth"
              component={SplashScreen}
              options={{ headerShown: false }}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </I18nextProvider>
  );
}
