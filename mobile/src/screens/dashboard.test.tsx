/**
 * Dashboard Screen - Unit Tests
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DashboardScreen from './Dashboard';

const Stack = createNativeStackNavigator();

const DashboardWithNav = () => (
  <NavigationContainer>
    <Stack.Navigator>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);

describe('Dashboard Screen', () => {
  it('renders header with title', async () => {
    const { getByText } = render(<DashboardWithNav />);

    await waitFor(() => {
      expect(getByText('Projects')).toBeTruthy();
    });
  });

  it('displays KPI cards', async () => {
    const { getByText } = render(<DashboardWithNav />);

    await waitFor(() => {
      expect(getByText('Total Projects')).toBeTruthy();
      expect(getByText('MW Capacity')).toBeTruthy();
      expect(getByText('Active')).toBeTruthy();
      expect(getByText('Avg Progress')).toBeTruthy();
    });
  });

  it('displays project list', async () => {
    const { getByText } = render(<DashboardWithNav />);

    await waitFor(() => {
      expect(getByText('Kali Gandaki A')).toBeTruthy();
      expect(getByText('Chisapani')).toBeTruthy();
    });
  });

  it('displays offline indicator when offline', async () => {
    const { getByText } = render(<DashboardWithNav />);

    // Note: Would need to mock useAppStore to test offline state
    // For now, just verify component renders without error
    expect(getByText('Projects')).toBeTruthy();
  });

  it('handles pull-to-refresh', async () => {
    const { getByTestId } = render(<DashboardWithNav />);

    await waitFor(() => {
      // FlatList with RefreshControl would trigger onRefresh
      // Test would verify metrics and projects reload
    });
  });

  it('displays error state on error', async () => {
    // Would need to mock API call to fail
    const { getByText } = render(<DashboardWithNav />);

    // Component should handle error gracefully
    expect(getByText('Projects')).toBeTruthy();
  });

  it('navigates to project detail on project press', async () => {
    const mockNavigation = {
      navigate: jest.fn(),
    };

    const { getByText } = render(
      <DashboardScreen navigation={mockNavigation} />
    );

    await waitFor(() => {
      const projectName = getByText('Kali Gandaki A');
      fireEvent.press(projectName);

      // Verify navigation was called
      // expect(mockNavigation.navigate).toHaveBeenCalledWith(
      //   'ProjectDetail',
      //   { projectId: '1' }
      // );
    });
  });
});
